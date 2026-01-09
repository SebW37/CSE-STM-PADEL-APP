/**
 * Règles métier pour les réservations
 * Validation des contraintes : 2 réservations simultanées max, 7 jours à l'avance
 */
import { prisma } from './client'
import { BookingStatus } from '@prisma/client'

/**
 * Vérifie si un utilisateur peut créer une nouvelle réservation
 * Contrainte : Maximum 2 réservations actives par employé (en tant qu'organisateur OU participant)
 * L'utilisateur ne doit pas être bloqué
 * @returns {Promise<{canCreate: boolean, reason?: string, blockingUsers?: Array<{name: string, role: 'organizer' | 'participant', bookingDate: Date}>}>}
 */
export async function canUserCreateBooking(userId: string): Promise<{
  canCreate: boolean
  reason?: string
  blockingUsers?: Array<{ name: string; role: 'organizer' | 'participant'; bookingDate: Date }>
  activeCount?: number
}> {
  // Vérifier d'abord si l'utilisateur est bloqué
  // On récupère tous les champs nécessaires pour éviter les erreurs si bloque n'existe pas encore
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return { canCreate: false, reason: 'Utilisateur non trouvé' }
  }

  // Vérifier si l'utilisateur est bloqué (peut être undefined si le champ n'existe pas encore)
  if (user.bloque === true) {
    return { canCreate: false, reason: 'Votre compte est bloqué' }
  }

  const now = new Date()
  
  // Récupérer les réservations où l'utilisateur est organisateur
  const asOrganizer = await prisma.booking.findMany({
    where: {
      userId,
      statut: BookingStatus.CONFIRME,
      date: {
        gte: now // Réservations futures uniquement
      }
    },
    include: {
      user: {
        select: {
          nom: true,
          prenom: true
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
    orderBy: {
      date: 'asc'
    }
  })

  // Récupérer les réservations où l'utilisateur est participant (mais pas organisateur)
  const asParticipant = await prisma.bookingParticipant.findMany({
    where: {
      userId,
      booking: {
        statut: BookingStatus.CONFIRME,
        date: {
          gte: now
        },
        userId: {
          not: userId // Exclure celles où il est aussi organisateur
        }
      }
    },
    include: {
      booking: {
        include: {
          user: {
            select: {
              nom: true,
              prenom: true
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
        }
      }
    },
    orderBy: {
      booking: {
        date: 'asc'
      }
    }
  })

  const totalActiveBookings = asOrganizer.length + asParticipant.length
  
  if (totalActiveBookings >= 2) {
    // Construire la liste des utilisateurs qui bloquent
    const blockingUsers: Array<{ name: string; role: 'organizer' | 'participant'; bookingDate: Date }> = []
    
    // Pour les réservations où l'utilisateur est organisateur, on liste les participants
    asOrganizer.forEach(booking => {
      booking.participants?.forEach(participant => {
        blockingUsers.push({
          name: `${participant.user.prenom} ${participant.user.nom}`,
          role: 'participant',
          bookingDate: booking.date
        })
      })
    })
    
    // Pour les réservations où l'utilisateur est participant, on liste l'organisateur et les autres participants
    asParticipant.forEach(participation => {
      const booking = participation.booking
      // Ajouter l'organisateur
      blockingUsers.push({
        name: `${booking.user.prenom} ${booking.user.nom}`,
        role: 'organizer',
        bookingDate: booking.date
      })
      // Ajouter les autres participants
      booking.participants?.forEach(participant => {
        if (participant.userId !== userId) {
          blockingUsers.push({
            name: `${participant.user.prenom} ${participant.user.nom}`,
            role: 'participant',
            bookingDate: booking.date
          })
        }
      })
    })
    
    return {
      canCreate: false,
      reason: 'Quota de réservations atteint',
      blockingUsers: blockingUsers.slice(0, 10), // Limiter à 10 pour éviter un message trop long
      activeCount: totalActiveBookings
    }
  }

  return { canCreate: true, activeCount: totalActiveBookings }
}

/**
 * Vérifie si une date de réservation est valide
 * Contrainte : Réservation possible 24h/24 et 7j/7 (pas de limite de jours)
 * Permet les réservations aujourd'hui si le créneau est dans le futur
 */
export function isBookingDateValid(bookingDate: Date): boolean {
  const now = new Date()

  // La date doit simplement être dans le futur (même aujourd'hui si c'est plus tard)
  return bookingDate > now
}

/**
 * Vérifie si un terrain est disponible à une date/heure donnée
 */
export async function isCourtAvailable(
  courtId: string,
  bookingDate: Date,
  duree: number = 60,
  excludeBookingId?: string
): Promise<boolean> {
  // Vérifier d'abord si le terrain est actif (pas en maintenance)
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { actif: true }
  })

  if (!court) {
    return false // Terrain non trouvé
  }

  if (!court.actif) {
    return false // Terrain en maintenance
  }

  const startTime = bookingDate
  const endTime = new Date(bookingDate.getTime() + duree * 60000)

  // Vérifier les blocages de plages horaires
  const bookingDateStr = bookingDate.toISOString().split('T')[0]
  const bookingHour = bookingDate.getHours()
  const bookingMinute = bookingDate.getMinutes()
  const bookingTimeStr = `${String(bookingHour).padStart(2, '0')}:${String(bookingMinute).padStart(2, '0')}`
  const endHour = endTime.getHours()
  const endMinute = endTime.getMinutes()
  const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

  const blockedSlots = await prisma.timeSlotBlock.findMany({
    where: {
      actif: true,
      date: {
        gte: new Date(bookingDateStr + 'T00:00:00'),
        lte: new Date(bookingDateStr + 'T23:59:59')
      },
      OR: [
        { courtId: courtId },
        { courtId: null } // Blocages globaux
      ]
    }
  })

  // Vérifier si la réservation chevauche un blocage
  for (const block of blockedSlots) {
    if (bookingTimeStr < block.endTime && endTimeStr > block.startTime) {
      return false // Le créneau est bloqué
    }
  }

  // Récupérer toutes les réservations confirmées pour ce terrain
  const existingBookings = await prisma.booking.findMany({
    where: {
      courtId,
      statut: BookingStatus.CONFIRME,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
    }
  })

  // Vérifier les chevauchements
  for (const booking of existingBookings) {
    const existingStart = booking.date
    const existingEnd = new Date(existingStart.getTime() + booking.duree * 60000)

    // Vérifier si les créneaux se chevauchent
    // Chevauchement si : notre début est avant la fin existante ET notre fin est après le début existant
    if (startTime < existingEnd && endTime > existingStart) {
      return false
    }
  }

  return true
}

/**
 * Compte le nombre de réservations actives d'un utilisateur (organisateur + participant)
 */
export async function getActiveBookingsCount(userId: string): Promise<number> {
  const now = new Date()
  
  // Compter les réservations où l'utilisateur est organisateur
  const asOrganizer = await prisma.booking.count({
    where: {
      userId,
      statut: BookingStatus.CONFIRME,
      date: {
        gte: now
      }
    }
  })

  // Compter les réservations où l'utilisateur est participant (mais pas organisateur)
  const asParticipant = await prisma.bookingParticipant.count({
    where: {
      userId,
      booking: {
        statut: BookingStatus.CONFIRME,
        date: {
          gte: now
        },
        userId: {
          not: userId // Exclure celles où il est aussi organisateur
        }
      }
    }
  })

  return asOrganizer + asParticipant
}

/**
 * Vérifie si un utilisateur peut créer une réservation pour une semaine donnée
 * Contrainte : Maximum 2 réservations par semaine
 * 
 * @deprecated Cette fonction n'est plus utilisée. Utilisez canUserCreateBooking() à la place
 * qui vérifie les réservations simultanées (2 max) au lieu du quota hebdomadaire.
 */
export async function canUserCreateBookingForWeek(
  userId: string,
  bookingDate: Date
): Promise<boolean> {
  // Calculer le début et la fin de la semaine (lundi à dimanche)
  const date = new Date(bookingDate)
  const dayOfWeek = date.getDay()
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Ajuster pour lundi = 0
  const weekStart = new Date(date.setDate(diff))
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  // Compter les réservations confirmées dans cette semaine
  const bookingsThisWeek = await prisma.booking.count({
    where: {
      userId,
      statut: BookingStatus.CONFIRME,
      date: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  return bookingsThisWeek < 2
}

/**
 * Vérifie que les 3 terrains existent bien en base
 * À exécuter lors de l'initialisation de l'application
 */
export async function ensureCourtsExist(): Promise<void> {
  const courtsCount = await prisma.court.count()

  if (courtsCount === 0) {
    // Créer les 3 terrains par défaut
    await prisma.court.createMany({
      data: [
        { numero: 1, nom: 'Court Central', actif: true },
        { numero: 2, nom: 'Court Est', actif: true },
        { numero: 3, nom: 'Court Ouest', actif: true }
      ]
    })
  } else if (courtsCount !== 3) {
    console.warn(
      `Attention: Le nombre de terrains (${courtsCount}) ne correspond pas à la contrainte (3 terrains requis)`
    )
  }
}


