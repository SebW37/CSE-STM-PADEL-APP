/**
 * Script pour vérifier les réservations où les utilisateurs participent (en tant que participant)
 * Usage: tsx scripts/check-participations.ts
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'
import { format } from 'date-fns'

async function main() {
  console.log('🔍 Vérification des participations aux réservations...\n')

  try {
    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true
      }
    })

    const now = new Date()
    const violations: Array<{
      user: { id: string; email: string; nom: string; prenom: string }
      asOrganizer: number
      asParticipant: number
      total: number
      bookings: Array<{ id: string; date: Date; role: 'organizer' | 'participant' }>
    }> = []

    // Vérifier chaque utilisateur
    for (const user of users) {
      // Réservations où l'utilisateur est organisateur
      const asOrganizer = await prisma.booking.findMany({
        where: {
          userId: user.id,
          statut: BookingStatus.CONFIRME,
          date: {
            gte: now
          }
        },
        select: {
          id: true,
          date: true
        }
      })

      // Réservations où l'utilisateur est participant (mais pas organisateur)
      const asParticipant = await prisma.bookingParticipant.findMany({
        where: {
          userId: user.id,
          booking: {
            statut: BookingStatus.CONFIRME,
            date: {
              gte: now
            },
            userId: {
              not: user.id // Exclure celles où il est aussi organisateur
            }
          }
        },
        include: {
          booking: {
            select: {
              id: true,
              date: true
            }
          }
        }
      })

      const total = asOrganizer.length + asParticipant.length

      if (total > 2) {
        const bookings = [
          ...asOrganizer.map(b => ({ id: b.id, date: b.date, role: 'organizer' as const })),
          ...asParticipant.map(p => ({ id: p.booking.id, date: p.booking.date, role: 'participant' as const }))
        ].sort((a, b) => a.date.getTime() - b.date.getTime())

        violations.push({
          user,
          asOrganizer: asOrganizer.length,
          asParticipant: asParticipant.length,
          total,
          bookings
        })
      }
    }

    if (violations.length === 0) {
      console.log('✅ Tous les utilisateurs respectent la règle (en comptant organisateur + participant).')
      return
    }

    console.log(`⚠️  ${violations.length} utilisateur(s) avec plus de 2 réservations actives (organisateur + participant):\n`)

    for (const violation of violations) {
      console.log(`📋 ${violation.user.prenom} ${violation.user.nom} (${violation.user.email})`)
      console.log(`   Organisateur: ${violation.asOrganizer} réservation(s)`)
      console.log(`   Participant: ${violation.asParticipant} réservation(s)`)
      console.log(`   Total: ${violation.total} réservation(s) actives (limite: 2)\n`)
      
      violation.bookings.forEach((booking, idx) => {
        const dateStr = format(booking.date, 'dd/MM/yyyy à HH:mm')
        const role = booking.role === 'organizer' ? 'Organisateur' : 'Participant'
        console.log(`   ${idx + 1}. ${dateStr} - ${role} (ID: ${booking.id})`)
      })
      console.log('')
    }

    console.log('💡 Note: La règle actuelle compte uniquement les réservations où l\'utilisateur est organisateur.')
    console.log('   Si vous voulez compter aussi les participations, il faut modifier la règle.')
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


