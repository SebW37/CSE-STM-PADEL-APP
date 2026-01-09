/**
 * Script de débogage pour voir les réservations actives d'un utilisateur
 * Usage: tsx scripts/debug-user-bookings.ts <email>
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'

async function main() {
  const email = process.argv[2]
  
  if (!email) {
    console.error('Usage: tsx scripts/debug-user-bookings.ts <email>')
    process.exit(1)
  }

  console.log(`🔍 Recherche des réservations pour: ${email}\n`)

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ Utilisateur non trouvé: ${email}`)
      process.exit(1)
    }

    console.log(`✅ Utilisateur trouvé: ${user.prenom} ${user.nom} (ID: ${user.id})\n`)

    const now = new Date()
    console.log(`📅 Date actuelle: ${now.toISOString()}\n`)

    // Réservations en tant qu'organisateur
    const asOrganizer = await prisma.booking.findMany({
      where: {
        userId: user.id,
        statut: BookingStatus.CONFIRME,
        date: { gte: now }
      },
      include: {
        court: true,
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    console.log(`📋 Réservations en tant qu'organisateur: ${asOrganizer.length}`)
    asOrganizer.forEach((booking, index) => {
      console.log(`  ${index + 1}. ${new Date(booking.date).toLocaleString('fr-FR')}`)
      console.log(`     Terrain: ${booking.court.numero} - ${booking.court.nom}`)
      console.log(`     Tickets utilisés: ${booking.ticketsUtilises}, Utilise tickets: ${booking.utiliseTickets}`)
      console.log(`     Participants: ${booking.participants.length}`)
      if (booking.participants.length > 0) {
        booking.participants.forEach(p => {
          console.log(`       - ${p.user.prenom} ${p.user.nom}`)
        })
      }
      console.log('')
    })

    // Réservations en tant que participant
    const asParticipant = await prisma.bookingParticipant.findMany({
      where: {
        userId: user.id,
        booking: {
          statut: BookingStatus.CONFIRME,
          date: { gte: now },
          userId: { not: user.id } // Exclure celles où il est aussi organisateur
        }
      },
      include: {
        booking: {
          include: {
            court: true,
            user: {
              select: {
                nom: true,
                prenom: true
              }
            }
          }
        }
      },
      orderBy: {
        booking: {
          date: 'asc'
        }
      }
    })

    console.log(`👥 Réservations en tant que participant: ${asParticipant.length}`)
    asParticipant.forEach((participation, index) => {
      const booking = participation.booking
      console.log(`  ${index + 1}. ${new Date(booking.date).toLocaleString('fr-FR')}`)
      console.log(`     Organisateur: ${booking.user.prenom} ${booking.user.nom}`)
      console.log(`     Terrain: ${booking.court.numero} - ${booking.court.nom}`)
      console.log('')
    })

    const total = asOrganizer.length + asParticipant.length
    console.log(`\n📊 Total réservations actives: ${total}`)
    console.log(`   - En tant qu'organisateur: ${asOrganizer.length}`)
    console.log(`   - En tant que participant: ${asParticipant.length}`)
    console.log(`\n✅ Peut créer une nouvelle réservation: ${total < 2 ? 'OUI' : 'NON'}`)
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

