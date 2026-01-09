/**
 * Script pour lister toutes les réservations actives par utilisateur
 * Usage: tsx scripts/list-user-bookings.ts [email]
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'
import { format } from 'date-fns'

async function main() {
  const emailFilter = process.argv[2]

  console.log('📋 Liste des réservations actives par utilisateur...\n')

  try {
    const where: any = {
      statut: BookingStatus.CONFIRME,
      date: {
        gte: new Date() // Réservations futures uniquement
      }
    }

    if (emailFilter) {
      const user = await prisma.user.findUnique({
        where: { email: emailFilter }
      })
      if (!user) {
        console.error(`❌ Utilisateur ${emailFilter} non trouvé`)
        process.exit(1)
      }
      where.userId = user.id
    }

    // Récupérer toutes les réservations actives
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true
          }
        },
        court: {
          select: {
            numero: true,
            nom: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                nom: true,
                prenom: true
              }
            }
          }
        }
      },
      orderBy: [
        { userId: 'asc' },
        { date: 'asc' }
      ]
    })

    // Grouper par utilisateur
    const bookingsByUser = new Map<string, typeof bookings>()
    
    for (const booking of bookings) {
      const userId = booking.userId
      if (!bookingsByUser.has(userId)) {
        bookingsByUser.set(userId, [])
      }
      bookingsByUser.get(userId)!.push(booking)
    }

    // Afficher les résultats
    let totalViolations = 0
    
    for (const [userId, userBookings] of bookingsByUser.entries()) {
      const user = userBookings[0].user
      const count = userBookings.length

      if (count > 2) {
        console.log(`⚠️  ${user.prenom} ${user.nom} (${user.email})`)
        console.log(`   ${count} réservations actives (limite: 2)\n`)
        totalViolations++
      } else {
        if (!emailFilter) {
          // Afficher aussi les utilisateurs qui respectent la règle si pas de filtre
          console.log(`✅ ${user.prenom} ${user.nom} (${user.email})`)
          console.log(`   ${count} réservation(s) active(s)\n`)
        }
      }

      // Afficher les détails des réservations
      userBookings.forEach((booking, idx) => {
        const dateStr = format(new Date(booking.date), 'dd/MM/yyyy à HH:mm')
        const participants = booking.participants.map(p => `${p.user.prenom} ${p.user.nom}`).join(', ')
        console.log(`   ${idx + 1}. Terrain ${booking.court.numero} - ${dateStr} (${booking.duree}min)`)
        console.log(`      Participants: ${participants}`)
      })
      console.log('')
    }

    if (totalViolations > 0) {
      console.log(`\n⚠️  ${totalViolations} utilisateur(s) avec plus de 2 réservations actives`)
      console.log('💡 Pour corriger: npm run bookings:fix-quotas')
    } else {
      console.log('\n✅ Tous les utilisateurs respectent la règle des 2 réservations simultanées.')
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

