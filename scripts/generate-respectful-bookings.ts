/**
 * Script pour générer des réservations en respectant toutes les règles
 * - Maximum 2 réservations actives par utilisateur (organisateur + participant)
 * - 4 participants requis
 * - Pas de chevauchement de créneaux
 * - Réservations 24h/24 et 7j/7
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'
import { canUserCreateBooking, isCourtAvailable, isBookingDateValid } from '../lib/prisma/rules'

async function main() {
  const numBookings = parseInt(process.argv[2]) || 50
  console.log(`🚀 Génération de ${numBookings} réservations en respectant les règles...\n`)

  try {
    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        soldeCredits: true
      }
    })

    if (users.length < 4) {
      console.error('❌ Il faut au moins 4 utilisateurs pour créer des réservations')
      process.exit(1)
    }

    console.log(`📋 ${users.length} utilisateurs trouvés`)

    // Récupérer tous les terrains
    const courts = await prisma.court.findMany({
      where: { actif: true }
    })

    if (courts.length === 0) {
      console.error('❌ Aucun terrain actif trouvé')
      process.exit(1)
    }

    console.log(`🏟️  ${courts.length} terrains trouvés\n`)

    // S'assurer que tous les utilisateurs ont assez de crédits
    console.log(`💳 Attribution de 20 crédits à chaque utilisateur...`)
    await prisma.user.updateMany({
      data: {
        soldeCredits: 20
      }
    })

    let created = 0
    let skipped = 0
    const maxAttempts = numBookings * 10 // Limiter les tentatives

    // Générer les réservations
    for (let attempt = 0; attempt < maxAttempts && created < numBookings; attempt++) {
      // Générer une date aléatoire dans les 30 prochains jours
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const randomDayOffset = Math.floor(Math.random() * 30) // 0 à 29 jours
      const bookingDate = new Date(today)
      bookingDate.setDate(today.getDate() + randomDayOffset)
      
      // Générer une heure aléatoire entre 0h et 23h
      const randomHour = Math.floor(Math.random() * 24)
      const randomMinute = Math.random() < 0.5 ? 0 : 30
      bookingDate.setHours(randomHour, randomMinute, 0, 0)

      // Déterminer la durée (60 min entre 12h-14h, sinon 90 min)
      const duree = (randomHour >= 12 && randomHour < 14) ? 60 : 90

      // Vérifier que la date est valide
      if (!isBookingDateValid(bookingDate)) {
        skipped++
        continue
      }

      // Sélectionner un terrain aléatoire
      const court = courts[Math.floor(Math.random() * courts.length)]

      // Vérifier que le terrain est disponible
      const isAvailable = await isCourtAvailable(court.id, bookingDate, duree)
      if (!isAvailable) {
        skipped++
        continue
      }

      // Sélectionner un organisateur aléatoire
      const organizer = users[Math.floor(Math.random() * users.length)]

      // Vérifier que l'organisateur peut créer une réservation
      if (!(await canUserCreateBooking(organizer.id))) {
        skipped++
        continue
      }

      // Sélectionner 3 autres participants aléatoires
      const otherUsers = users.filter(u => u.id !== organizer.id)
      const shuffled = otherUsers.sort(() => 0.5 - Math.random())
      const participants = shuffled.slice(0, 3)

      if (participants.length < 3) {
        skipped++
        continue
      }

      const participantIds = [organizer.id, ...participants.map(p => p.id)]

      // Vérifier que tous les participants peuvent participer (pas plus de 2 réservations actives)
      let allParticipantsCanJoin = true
      for (const participantId of participantIds) {
        if (!(await canUserCreateBooking(participantId))) {
          allParticipantsCanJoin = false
          break
        }
      }

      if (!allParticipantsCanJoin) {
        skipped++
        continue
      }

      try {
        // Créer la réservation
        const booking = await prisma.booking.create({
          data: {
            userId: organizer.id,
            courtId: court.id,
            date: bookingDate,
            duree: duree,
            statut: BookingStatus.CONFIRME,
            creditsUtilises: 1,
            participants: {
              create: participantIds.map(userId => ({ userId }))
            }
          },
          include: {
            court: true,
            user: {
              select: {
                nom: true,
                prenom: true
              }
            }
          }
        })

        // Déduire les crédits de l'organisateur
        await prisma.user.update({
          where: { id: organizer.id },
          data: {
            soldeCredits: {
              decrement: 1
            }
          }
        })

        created++
        const dateStr = bookingDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        console.log(
          `✅ ${created}. ${organizer.prenom} ${organizer.nom} - Terrain ${booking.court.numero} - ${dateStr} (${duree}min)`
        )
      } catch (error: any) {
        console.error(`❌ Erreur lors de la création: ${error.message}`)
        skipped++
      }
    }

    console.log(`\n📊 Résumé:`)
    console.log(`   ✅ Réservations créées: ${created}`)
    console.log(`   ⏭️  Réservations ignorées: ${skipped}`)
    console.log(`   📝 Total tentatives: ${created + skipped}`)

    // Vérifier les quotas
    console.log(`\n🔍 Vérification des quotas:`)
    for (const user of users) {
      const canCreate = await canUserCreateBooking(user.id)
      if (!canCreate) {
        // Compter les réservations
        const asOrganizer = await prisma.booking.count({
          where: {
            userId: user.id,
            statut: BookingStatus.CONFIRME,
            date: { gte: new Date() }
          }
        })
        const asParticipant = await prisma.bookingParticipant.count({
          where: {
            userId: user.id,
            booking: {
              statut: BookingStatus.CONFIRME,
              date: { gte: new Date() },
              userId: { not: user.id }
            }
          }
        })
        const total = asOrganizer + asParticipant
        if (total > 2) {
          console.log(`   ⚠️  ${user.prenom} ${user.nom}: ${total} réservations actives (${asOrganizer} organisateur, ${asParticipant} participant)`)
        } else {
          console.log(`   ✅ ${user.prenom} ${user.nom}: ${total} réservation(s) active(s)`)
        }
      } else {
        const asOrganizer = await prisma.booking.count({
          where: {
            userId: user.id,
            statut: BookingStatus.CONFIRME,
            date: { gte: new Date() }
          }
        })
        const asParticipant = await prisma.bookingParticipant.count({
          where: {
            userId: user.id,
            booking: {
              statut: BookingStatus.CONFIRME,
              date: { gte: new Date() },
              userId: { not: user.id }
            }
          }
        })
        const total = asOrganizer + asParticipant
        if (total > 0) {
          console.log(`   ✅ ${user.prenom} ${user.nom}: ${total} réservation(s) active(s)`)
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Erreur générale:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

