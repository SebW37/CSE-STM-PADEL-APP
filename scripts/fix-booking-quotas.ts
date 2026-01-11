/**
 * Script pour corriger les utilisateurs ayant plus de 2 réservations actives
 * Annule les réservations en trop (garde les 2 plus proches)
 */
import { PrismaClient, BookingStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Recherche des utilisateurs avec plus de 2 réservations actives...\n')

  const now = new Date()
  
  // Récupérer tous les utilisateurs
  const users = await prisma.user.findMany({
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true
    }
  })

  let totalFixed = 0
  let totalUsersAffected = 0

  for (const user of users) {
    // Récupérer les réservations où l'utilisateur est organisateur
    const asOrganizer = await prisma.booking.findMany({
      where: {
        userId: user.id,
        statut: BookingStatus.CONFIRME,
        date: {
          gte: now
        }
      },
      orderBy: {
        date: 'asc' // Plus proches en premier
      }
    })

    // Récupérer les réservations où l'utilisateur est participant (mais pas organisateur)
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
        booking: true
      },
      orderBy: {
        booking: {
          date: 'asc'
        }
      }
    })

    // Combiner toutes les réservations actives
    const allActiveBookings = [
      ...asOrganizer.map(b => ({ booking: b, role: 'organizer' as const })),
      ...asParticipant.map(p => ({ booking: p.booking, role: 'participant' as const }))
    ].sort((a, b) => a.booking.date.getTime() - b.booking.date.getTime())

    const activeCount = allActiveBookings.length

    if (activeCount > 2) {
      totalUsersAffected++
      console.log(`⚠️  ${user.prenom} ${user.nom} (${user.email}) : ${activeCount} réservations actives`)
      
      // Garder les 2 plus proches, annuler les autres
      const toKeep = allActiveBookings.slice(0, 2)
      const toCancel = allActiveBookings.slice(2)

      console.log(`   ✅ Conservation des 2 plus proches :`)
      for (const item of toKeep) {
        const dateStr = item.booking.date.toLocaleString('fr-FR')
        console.log(`      - ${dateStr} (${item.role === 'organizer' ? 'Organisateur' : 'Participant'})`)
      }

      console.log(`   ❌ Annulation de ${toCancel.length} réservation(s) :`)
      
      for (const item of toCancel) {
        const dateStr = item.booking.date.toLocaleString('fr-FR')
        console.log(`      - ${dateStr} (${item.role === 'organizer' ? 'Organisateur' : 'Participant'})`)

        if (item.role === 'organizer') {
          // Si c'est l'organisateur, annuler la réservation complète
          // Restituer les tickets si nécessaire
          if (item.booking.utiliseTickets && item.booking.ticketsUtilises > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                soldeTickets: {
                  increment: item.booking.ticketsUtilises
                }
              }
            })
            console.log(`         💰 ${item.booking.ticketsUtilises} ticket(s) restitué(s)`)
          }

          await prisma.booking.update({
            where: { id: item.booking.id },
            data: {
              statut: BookingStatus.ANNULE
            }
          })
          totalFixed++
        } else {
          // Si c'est un participant, juste le retirer de la réservation
          await prisma.bookingParticipant.deleteMany({
            where: {
              bookingId: item.booking.id,
              userId: user.id
            }
          })
          totalFixed++
        }
      }
      console.log('')
    }
  }

  console.log('\n✅ Correction terminée !')
  console.log(`   - ${totalUsersAffected} utilisateur(s) affecté(s)`)
  console.log(`   - ${totalFixed} réservation(s) corrigée(s)`)
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

