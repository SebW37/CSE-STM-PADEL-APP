/**
 * Script pour vérifier et corriger les utilisateurs ayant plus de 2 réservations simultanées
 * Usage: tsx scripts/check-booking-quotas.ts [--fix]
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'

async function main() {
  const shouldFix = process.argv.includes('--fix')
  
  console.log('🔍 Vérification des quotas de réservations...\n')

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
      count: number
      bookings: Array<{ id: string; date: Date; isOrganizer: boolean }>
    }> = []

    // Vérifier chaque utilisateur
    for (const user of users) {
      // Réservations où l'utilisateur est organisateur
      const asOrganizer = await prisma.booking.findMany({
        where: {
          userId: user.id,
          statut: BookingStatus.CONFIRME,
          date: {
            gte: now // Réservations futures uniquement
          }
        },
        orderBy: {
          date: 'asc'
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

      const totalBookings = asOrganizer.length + asParticipant.length
      const allBookings = [
        ...asOrganizer.map(b => ({ id: b.id, date: b.date, isOrganizer: true })),
        ...asParticipant.map(p => ({ id: p.booking.id, date: p.booking.date, isOrganizer: false }))
      ].sort((a, b) => a.date.getTime() - b.date.getTime())

      if (totalBookings > 2) {
        violations.push({
          user,
          count: totalBookings,
          bookings: allBookings
        })
      }
    }

    if (violations.length === 0) {
      console.log('✅ Tous les utilisateurs respectent la règle des 2 réservations simultanées.')
      return
    }

    console.log(`⚠️  ${violations.length} utilisateur(s) avec plus de 2 réservations simultanées:\n`)

    for (const violation of violations) {
      console.log(`📋 ${violation.user.prenom} ${violation.user.nom} (${violation.user.email})`)
      console.log(`   ${violation.count} réservations actives (limite: 2)`)
      
      violation.bookings.forEach((booking, idx) => {
        const dateStr = booking.date.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        console.log(`   ${idx + 1}. ${dateStr} (ID: ${booking.id})`)
      })

      if (shouldFix) {
        // Garder les 2 premières réservations (les plus proches)
        const toKeep = violation.bookings.slice(0, 2)
        const toRemove = violation.bookings.slice(2)

        console.log(`   ✅ Conservation des 2 premières réservations`)
        console.log(`   ❌ Retrait de ${toRemove.length} réservation(s) en trop`)

        for (const booking of toRemove) {
          if (booking.isOrganizer) {
            // Si l'utilisateur est organisateur, annuler toute la réservation
            const bookingData = await prisma.booking.findUnique({
              where: { id: booking.id },
              select: { userId: true, creditsUtilises: true }
            })

            if (bookingData) {
              await prisma.booking.update({
                where: { id: booking.id },
                data: { statut: BookingStatus.ANNULE }
              })

              // Restituer les crédits
              await prisma.user.update({
                where: { id: bookingData.userId },
                data: {
                  soldeCredits: {
                    increment: bookingData.creditsUtilises
                  }
                }
              })
            }
          } else {
            // Si l'utilisateur est participant, le retirer
            await prisma.bookingParticipant.deleteMany({
              where: {
                bookingId: booking.id,
                userId: violation.user.id
              }
            })

            // Vérifier le nombre de participants restants
            const remainingCount = await prisma.bookingParticipant.count({
              where: { bookingId: booking.id }
            })

            // Si moins de 4 participants, annuler toute la réservation
            if (remainingCount < 4) {
              const bookingData = await prisma.booking.findUnique({
                where: { id: booking.id },
                select: { userId: true, creditsUtilises: true }
              })

              if (bookingData) {
                await prisma.booking.update({
                  where: { id: booking.id },
                  data: { statut: BookingStatus.ANNULE }
                })

                // Restituer les crédits à l'organisateur
                await prisma.user.update({
                  where: { id: bookingData.userId },
                  data: {
                    soldeCredits: {
                      increment: bookingData.creditsUtilises
                    }
                  }
                })
              }
            }
          }
        }
      }

      console.log('')
    }

    if (!shouldFix) {
      console.log('💡 Pour corriger automatiquement, exécutez: tsx scripts/check-booking-quotas.ts --fix')
    } else {
      console.log('✅ Corrections appliquées avec succès.')
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

