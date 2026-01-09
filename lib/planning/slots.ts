/**
 * Logique de génération des slots de réservation
 * Slots de 90 minutes sauf entre 12h et 14h où ce sont des slots de 60 minutes
 */

export interface TimeSlot {
  start: Date
  end: Date
  duration: number // en minutes
  label: string // Format "HH:MM"
}

/**
 * Vérifie si une date est dans le futur (ouvertes à la réservation)
 * Permet les réservations 24h/24 et 7j/7 (pas de limite de jours)
 */
export function isDateWithinBookingWindow(date: Date): boolean {
  const now = new Date()
  
  // La date doit simplement être dans le futur (même aujourd'hui si c'est plus tard)
  return date > now
}

/**
 * Génère les slots pour une journée donnée (24h/24)
 */
export function generateDaySlots(date: Date): TimeSlot[] {
  const slots: TimeSlot[] = []
  const startHour = 0 // 0h (minuit)
  const endHour = 24 // 24h (minuit suivant)
  
  let currentHour = startHour
  let currentMinute = 0

  while (currentHour < endHour) {
    // Déterminer la durée du slot
    // Entre 12h et 14h : slots de 60 minutes
    // Sinon : slots de 90 minutes
    const isLunchTime = currentHour >= 12 && currentHour < 14
    const duration = isLunchTime ? 60 : 90

    // Créer le slot
    const slotDate = new Date(date)
    slotDate.setHours(currentHour, currentMinute, 0, 0)
    
    const endDate = new Date(slotDate)
    endDate.setMinutes(endDate.getMinutes() + duration)

    // Vérifier si le slot dépasse 24h
    // Si le slot se termine le jour suivant, ajuster pour qu'il se termine à 23:59:59
    if (endDate.getDate() !== slotDate.getDate() || (endDate.getHours() === 0 && endDate.getMinutes() === 0 && currentHour !== 0)) {
      // Le slot se termine après minuit, l'ajuster pour qu'il se termine à 23:59:59
      const adjustedEnd = new Date(date)
      adjustedEnd.setHours(23, 59, 59, 999)
      const adjustedDuration = Math.floor((adjustedEnd.getTime() - slotDate.getTime()) / 60000)
      
      if (adjustedDuration > 0) {
        slots.push({
          start: slotDate,
          end: adjustedEnd,
          duration: adjustedDuration,
          label: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
        })
      }
      break
    }

    slots.push({
      start: slotDate,
      end: endDate,
      duration,
      label: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
    })

    // Passer au slot suivant
    if (duration === 90) {
      // Slot de 90 minutes = 1h30
      currentHour += 1
      currentMinute += 30
      if (currentMinute >= 60) {
        currentHour += 1
        currentMinute -= 60
      }
    } else {
      // Slot de 60 minutes
      currentHour += 1
      currentMinute = 0
    }
    
    // Si on dépasse 24h, arrêter
    if (currentHour >= 24) {
      break
    }
  }

  return slots
}

/**
 * Génère les slots pour les 7 prochains jours
 */
export function generateWeekSlots(startDate: Date = new Date()): Map<string, TimeSlot[]> {
  const slotsByDay = new Map<string, TimeSlot[]>()
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    date.setHours(0, 0, 0, 0)
    
    const dayKey = date.toISOString().split('T')[0] // Format YYYY-MM-DD
    slotsByDay.set(dayKey, generateDaySlots(date))
  }

  return slotsByDay
}

/**
 * Vérifie si un slot est dans le passé
 */
export function isSlotPast(slot: TimeSlot): boolean {
  return slot.start < new Date()
}

/**
 * Vérifie si un slot chevauche avec une réservation
 */
export function isSlotOverlapping(slot: TimeSlot, bookingStart: Date, bookingEnd: Date): boolean {
  return slot.start < bookingEnd && slot.end > bookingStart
}

/**
 * Vérifie si un slot est bloqué par une plage horaire bloquée
 */
export function isSlotBlocked(
  slot: TimeSlot,
  blockedSlots: Array<{ startTime: string; endTime: string; courtId: string | null }>
): boolean {
  const slotStartStr = `${String(slot.start.getHours()).padStart(2, '0')}:${String(slot.start.getMinutes()).padStart(2, '0')}`
  const slotEndStr = `${String(slot.end.getHours()).padStart(2, '0')}:${String(slot.end.getMinutes()).padStart(2, '0')}`

  return blockedSlots.some(block => {
    // Vérifier si le slot chevauche avec le blocage
    return slotStartStr < block.endTime && slotEndStr > block.startTime
  })
}

