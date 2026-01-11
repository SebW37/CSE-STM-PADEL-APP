/**
 * Script pour corriger les réservations d'un utilisateur spécifique
 * Usage: tsx scripts/fix-user-bookings.ts <email>
 */
import { PrismaClient, BookingStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Usage: tsx scripts/fix-user-bookings.ts <email>')
    process.exit(1)
  }

  console.log(`🔍 Recherche de l'utilisateur: ${email}\n`)

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true
    }
  })

  if (!user) {
    console.error(`❌ Utilisateur non trouvé: ${email}`)
    process.exit(1)
  }

  console.log(`✅ Utilisateur trouvé: ${user.prenom} ${user.nom}\n`)

  const now = new Date()
  
  // Récupérer les réservations où l'utilisateur est organisateur
  const asOrganizer = await prisma.booking.findMany({
    where: {
      userId: user.id,
      statut: BookingStatus.CONFIRME,
      date: {
        gte: now
      }
    },
    include: {
      court: true
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

  // Combiner toutes les réservations actives
  const allActiveBookings = [
    ...asOrganizer.map(b => ({ 
      booking: b, 
      role: 'organizer' as const,
      id: b.id,
      date: b.date
    })),
    ...asParticipant.map(p => ({ 
      booking: p.booking, 
      role: 'participant' as const,
      id: p.booking.id,
      date: p.booking.date
    }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  const activeCount = allActiveBookings.length

  console.log(`📊 Réservations actives: ${activeCount}\n`)

  if (activeCount === 0) {
    console.log('✅ Aucune réservation active.')
    return
  }

  // Afficher toutes les réservations
  console.log('📅 Liste des réservations actives:\n')
  allActiveBookings.forEach((item, index) => {
    const dateStr = item.date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    const courtInfo = `Terrain ${item.booking.court.numero} - ${item.booking.court.nom}`
    const roleInfo = item.role === 'organizer' ? 'Organisateur' : `Participant (org: ${item.booking.user?.prenom} ${item.booking.user?.nom})`
    const ticketsInfo = item.booking.utiliseTickets ? ` (${item.booking.ticketsUtilises} ticket(s))` : ''
    
    console.log(`   ${index + 1}. ${dateStr} - ${courtInfo}`)
    console.log(`      ${roleInfo}${ticketsInfo}`)
  })

  if (activeCount > 2) {
    console.log(`\n⚠️  ${activeCount} réservations actives (maximum 2 autorisées)\n`)
    
    // Garder les 2 plus proches, annuler les autres
    const toKeep = allActiveBookings.slice(0, 2)
    const toCancel = allActiveBookings.slice(2)

    console.log(`✅ Conservation des 2 plus proches :`)
    for (const item of toKeep) {
      const dateStr = item.date.toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      console.log(`   - ${dateStr} (${item.role === 'organizer' ? 'Organisateur' : 'Participant'})`)
    }

    console.log(`\n❌ Annulation de ${toCancel.length} réservation(s) :`)
    
    for (const item of toCancel) {
      const dateStr = item.date.toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      console.log(`   - ${dateStr} (${item.role === 'organizer' ? 'Organisateur' : 'Participant'})`)

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
          console.log(`      💰 ${item.booking.ticketsUtilises} ticket(s) restitué(s)`)
        }

        await prisma.booking.update({
          where: { id: item.booking.id },
          data: {
            statut: BookingStatus.ANNULE
          }
        })
        console.log(`      ✅ Réservation annulée`)
      } else {
        // Si c'est un participant, juste le retirer de la réservation
        await prisma.bookingParticipant.deleteMany({
          where: {
            bookingId: item.booking.id,
            userId: user.id
          }
        })
        console.log(`      ✅ Participation retirée`)
        
        // Vérifier si la réservation a encore assez de participants
        const remainingCount = await prisma.bookingParticipant.count({
          where: { bookingId: item.booking.id }
        })
        
        if (remainingCount < 4) {
          // Annuler toute la réservation si moins de 4 participants
          const bookingData = await prisma.booking.findUnique({
            where: { id: item.booking.id },
            select: { userId: true, utiliseTickets: true, ticketsUtilises: true }
          })
          
          if (bookingData) {
            // Restituer les tickets à l'organisateur si nécessaire
            if (bookingData.utiliseTickets && bookingData.ticketsUtilises > 0) {
              await prisma.user.update({
                where: { id: bookingData.userId },
                data: {
                  soldeTickets: {
                    increment: bookingData.ticketsUtilises
                  }
                }
              })
            }
            
            await prisma.booking.update({
              where: { id: item.booking.id },
              data: {
                statut: BookingStatus.ANNULE
              }
            })
            console.log(`      ⚠️  Réservation annulée (moins de 4 participants)`)
          }
        }
      }
    }

    console.log('\n✅ Correction terminée !')
  } else {
    console.log('\n✅ Le nombre de réservations est correct (≤ 2).')
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

