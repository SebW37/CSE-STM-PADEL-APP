/**
 * Script pour générer des réservations de test
 * Usage: tsx scripts/generate-test-bookings.ts [nombre]
 * 
 * Génère des réservations aléatoires avec les utilisateurs existants
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'

// Créneaux horaires possibles (en heures)
const TIME_SLOTS = [
  { hour: 8, minute: 0, duration: 90 },   // 8h00 - 9h30
  { hour: 10, minute: 0, duration: 90 },  // 10h00 - 11h30
  { hour: 12, minute: 0, duration: 60 },   // 12h00 - 13h00
  { hour: 13, minute: 0, duration: 60 },   // 13h00 - 14h00
  { hour: 14, minute: 30, duration: 90 },  // 14h30 - 16h00
  { hour: 16, minute: 30, duration: 90 },  // 16h30 - 18h00
  { hour: 18, minute: 30, duration: 90 },  // 18h30 - 20h00
  { hour: 20, minute: 0, duration: 90 },   // 20h00 - 21h30
]

async function main() {
  const numberOfBookings = parseInt(process.argv[2]) || 20

  console.log(`🚀 Génération de ${numberOfBookings} réservations de test...\n`)

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
    const minCredits = Math.ceil(numberOfBookings / users.length) + 5
    console.log(`💳 Attribution de ${minCredits} crédits à chaque utilisateur...`)
    await prisma.user.updateMany({
      data: {
        soldeCredits: minCredits
      }
    })

    // Générer les dates (7 prochains jours)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dates: Date[] = []
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date)
    }

    let created = 0
    let skipped = 0
    const userBookingCounts = new Map<string, number>() // Compteur de réservations par utilisateur

    // Initialiser les compteurs
    users.forEach(user => {
      userBookingCounts.set(user.id, 0)
    })

    // Générer les réservations
    for (let i = 0; i < numberOfBookings && created < numberOfBookings; i++) {
      // Sélectionner une date aléatoire
      const randomDate = dates[Math.floor(Math.random() * dates.length)]
      
      // Sélectionner un créneau horaire aléatoire
      const timeSlot = TIME_SLOTS[Math.floor(Math.random() * TIME_SLOTS.length)]
      
      // Créer la date/heure complète
      const bookingDate = new Date(randomDate)
      bookingDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0)

      // Vérifier que la date n'est pas dans le passé
      if (bookingDate < new Date()) {
        skipped++
        continue
      }

      // Sélectionner un terrain aléatoire
      const court = courts[Math.floor(Math.random() * courts.length)]

      // Trouver un organisateur qui n'a pas encore 2 réservations
      const availableOrganizers = users.filter(
        user => (userBookingCounts.get(user.id) || 0) < 2
      )

      if (availableOrganizers.length === 0) {
        console.log('⚠️  Tous les utilisateurs ont déjà 2 réservations. Arrêt de la génération.')
        break
      }

      const organizer = availableOrganizers[Math.floor(Math.random() * availableOrganizers.length)]

      // Sélectionner 3 autres participants (différents de l'organisateur)
      const otherUsers = users.filter(u => u.id !== organizer.id)
      const shuffled = otherUsers.sort(() => 0.5 - Math.random())
      const participants = [organizer, ...shuffled.slice(0, 3)]
      const participantIds = participants.map(p => p.id)

      // Vérifier qu'il n'y a pas de chevauchement sur ce terrain à cette heure
      const existingBooking = await prisma.booking.findFirst({
        where: {
          courtId: court.id,
          statut: BookingStatus.CONFIRME,
          date: {
            gte: new Date(bookingDate.getTime() - timeSlot.duration * 60000),
            lte: new Date(bookingDate.getTime() + timeSlot.duration * 60000)
          }
        }
      })

      if (existingBooking) {
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
            duree: timeSlot.duration,
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

        // Incrémenter le compteur de réservations de l'organisateur
        userBookingCounts.set(organizer.id, (userBookingCounts.get(organizer.id) || 0) + 1)

        created++
        const dateStr = bookingDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        console.log(
          `✅ ${created}. ${organizer.prenom} ${organizer.nom} - Terrain ${booking.court.numero} - ${dateStr} (${timeSlot.duration}min)`
        )
      } catch (error: any) {
        console.error(`❌ Erreur lors de la création: ${error.message}`)
        skipped++
      }
    }

    console.log(`\n📊 Résumé:`)
    console.log(`   ✅ Réservations créées: ${created}`)
    console.log(`   ⏭️  Réservations ignorées: ${skipped}`)
    console.log(`   📝 Total tentatives: ${numberOfBookings}`)

    // Afficher le nombre de réservations par utilisateur
    console.log(`\n📈 Réservations par utilisateur:`)
    for (const [userId, count] of userBookingCounts.entries()) {
      const user = users.find(u => u.id === userId)
      if (user && count > 0) {
        console.log(`   ${user.prenom} ${user.nom}: ${count} réservation(s)`)
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

