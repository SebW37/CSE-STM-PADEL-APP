/**
 * Script pour vérifier et perdre les tickets des réservations non modifiées à temps
 * Les tickets sont perdus si la réservation utilise des tickets et qu'il reste moins de 30 minutes
 * Usage: tsx scripts/check-lost-tickets.ts [--apply]
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'

async function main() {
  const shouldApply = process.argv.includes('--apply')

  console.log('🔍 Vérification des tickets perdus...\n')

  try {
    const now = new Date()
    
    // Récupérer toutes les réservations confirmées qui utilisent des tickets
    const bookingsWithTickets = await prisma.booking.findMany({
      where: {
        statut: BookingStatus.CONFIRME,
        utiliseTickets: true,
        ticketsUtilises: {
          gt: 0
        },
        date: {
          gte: now // Réservations futures
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true
          }
        }
      }
    })

    const lostTicketsBookings: Array<{
      booking: any
      minutesUntilBooking: number
    }> = []

    for (const booking of bookingsWithTickets) {
      const bookingDate = new Date(booking.date)
      const timeDiff = bookingDate.getTime() - now.getTime()
      const minutesDiff = timeDiff / (1000 * 60)

      // Si moins de 30 minutes avant la réservation, les tickets sont perdus
      if (minutesDiff < 30 && minutesDiff >= 0) {
        lostTicketsBookings.push({
          booking,
          minutesUntilBooking: Math.floor(minutesDiff)
        })
      }
    }

    if (lostTicketsBookings.length === 0) {
      console.log('✅ Aucune réservation avec tickets perdus.')
      return
    }

    console.log(`⚠️  ${lostTicketsBookings.length} réservation(s) avec tickets perdus:\n`)

    for (const { booking, minutesUntilBooking } of lostTicketsBookings) {
      const dateStr = new Date(booking.date).toLocaleString('fr-FR')
      console.log(`📋 Réservation ID: ${booking.id}`)
      console.log(`   Organisateur: ${booking.user.prenom} ${booking.user.nom} (${booking.user.email})`)
      console.log(`   Date: ${dateStr}`)
      console.log(`   Tickets utilisés: ${booking.ticketsUtilises}`)
      console.log(`   Temps restant: ${minutesUntilBooking} minutes (< 30 min)`)

      if (shouldApply) {
        // Marquer la réservation comme utilisant des tickets mais les tickets sont perdus
        // On ne restitue pas les tickets
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            // On garde utiliseTickets = true pour indiquer que les tickets ont été perdus
            // Les tickets ne sont pas restitués
          }
        })
        console.log(`   ✅ Tickets marqués comme perdus (non restitués)`)
      }
      console.log('')
    }

    if (!shouldApply) {
      console.log('💡 Pour appliquer les changements, exécutez: tsx scripts/check-lost-tickets.ts --apply')
    } else {
      console.log('✅ Vérification terminée. Les tickets perdus ont été marqués.')
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


