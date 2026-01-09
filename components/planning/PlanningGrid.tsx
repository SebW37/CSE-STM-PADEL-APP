'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { generateDaySlots, isSlotPast, isSlotOverlapping, isDateWithinBookingWindow, type TimeSlot } from '@/lib/planning/slots'

interface Booking {
  id: string
  userId: string
  courtId: string
  date: string
  duree: number
  utiliseTickets?: boolean
  ticketsUtilises?: number
  user: {
    id: string
    nom: string
    prenom: string
  }
  court: {
    id: string
    numero: number
    nom: string
  }
  participants?: {
    user: {
      id: string
      nom: string
      prenom: string
    }
  }[]
}

interface Court {
  id: string
  numero: number
  nom: string
  actif: boolean
}

interface TimeSlotBlock {
  id: string
  courtId: string | null
  date: string
  startTime: string
  endTime: string
  raison: string | null
  court?: {
    id: string
    numero: number
    nom: string
  } | null
}

interface PlanningGridProps {
  date: Date
  courts: Court[]
  bookings: Booking[]
  currentUserId: string
  onSlotClick: (slot: TimeSlot, courtId: string) => void
  onCancelBooking?: (bookingId: string) => void
  onBookingClick?: (booking: Booking) => void // Nouveau prop pour cliquer sur une réservation
  blockedSlots?: TimeSlotBlock[]
  timeRangeFilter?: 'all' | '0-8' | '8-16' | '16-24'
  isAdmin?: boolean // Mode admin : permet de cliquer sur toutes les réservations
}

type SlotStatus = 'past' | 'occupied' | 'available' | 'my-booking' | 'my-participation' | 'blocked'

export function PlanningGrid({ date, courts, bookings, currentUserId, onSlotClick, onCancelBooking, onBookingClick, blockedSlots = [], timeRangeFilter = 'all', isAdmin = false }: PlanningGridProps) {
  // Régénérer les slots si la date change
  const [allSlots, setAllSlots] = useState<TimeSlot[]>(() => generateDaySlots(date))
  
  useEffect(() => {
    setAllSlots(generateDaySlots(date))
  }, [date])
  
  // Filtrer les slots selon la plage horaire sélectionnée
  const slots = allSlots.filter(slot => {
    if (timeRangeFilter === 'all') return true
    
    const hour = slot.start.getHours()
    
    switch (timeRangeFilter) {
      case '0-8':
        return hour >= 0 && hour < 8
      case '8-16':
        return hour >= 8 && hour < 16
      case '16-24':
        return hour >= 16 && hour < 24
      default:
        return true
    }
  })

  const getSlotStatus = (slot: TimeSlot, courtId: string): { status: SlotStatus; booking?: Booking; blockReason?: string } => {
    // Vérifier si le terrain est en maintenance
    const court = courts.find(c => c.id === courtId)
    if (court && !court.actif) {
      return { status: 'blocked', blockReason: 'En maintenance' }
    }

    // Vérifier si le slot est dans le passé
    if (isSlotPast(slot)) {
      return { status: 'past' }
    }

    // Vérifier si le slot est au-delà de 7 jours (non réservable)
    if (!isDateWithinBookingWindow(slot.start)) {
      return { status: 'past' } // Traiter comme passé pour l'affichage
    }

    // Vérifier si le slot est bloqué
    const slotDateStr = slot.start.toISOString().split('T')[0]
    const slotStartStr = `${String(slot.start.getHours()).padStart(2, '0')}:${String(slot.start.getMinutes()).padStart(2, '0')}`
    const slotEndStr = `${String(slot.end.getHours()).padStart(2, '0')}:${String(slot.end.getMinutes()).padStart(2, '0')}`
    
    const block = blockedSlots.find(block => {
      const blockDateStr = block.date ? new Date(block.date).toISOString().split('T')[0] : null
      const sameDate = !blockDateStr || blockDateStr === slotDateStr
      const appliesToCourt = !block.courtId || block.courtId === courtId
      const overlaps = slotStartStr < block.endTime && slotEndStr > block.startTime
      return sameDate && appliesToCourt && overlaps
    })

    if (block) {
      return { status: 'blocked', blockReason: block.raison || 'Bloqué' }
    }

    // Chercher une réservation qui chevauche ce slot
    const overlappingBooking = bookings.find(booking => 
      booking.courtId === courtId &&
      isSlotOverlapping(slot, new Date(booking.date), new Date(new Date(booking.date).getTime() + booking.duree * 60000))
    )

    if (overlappingBooking) {
      // Vérifier si c'est ma réservation (organisateur)
      if (overlappingBooking.userId === currentUserId) {
        return { status: 'my-booking', booking: overlappingBooking }
      }
      
      // Vérifier si je suis un participant
      const isParticipant = overlappingBooking.participants?.some(
        p => p.user.id === currentUserId
      )
      
      if (isParticipant) {
        return { status: 'my-participation', booking: overlappingBooking }
      }
      
      return { status: 'occupied', booking: overlappingBooking }
    }

    return { status: 'available' }
  }

  const getSlotColor = (status: SlotStatus): string => {
    switch (status) {
      case 'past':
        return 'bg-gray-200 text-gray-500 cursor-not-allowed'
      case 'blocked':
        return 'bg-orange-200 text-orange-800 border-orange-300 cursor-not-allowed'
      case 'occupied':
        return 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
      case 'available':
        return 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300 cursor-pointer'
      case 'my-booking':
        return 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300 cursor-pointer'
      case 'my-participation':
        return 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300 cursor-pointer'
      default:
        return 'bg-gray-100'
    }
  }

  const getSlotText = (status: SlotStatus, booking?: Booking, blockReason?: string): string => {
    if (booking?.utiliseTickets && status === 'my-booking') {
      return '3 Tickets'
    }
    switch (status) {
      case 'past':
        return 'Passé'
      case 'blocked':
        return blockReason ? (blockReason.length > 8 ? blockReason.substring(0, 8) + '...' : blockReason) : 'Bloqué'
      case 'occupied':
        return 'Réservé'
      case 'available':
        return 'Libre'
      case 'my-booking':
        return `Ma résa`
      case 'my-participation':
        return `Je participe`
      default:
        return ''
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full grid grid-cols-4 gap-4">
        {/* En-tête avec heures */}
        <div className="sticky left-0 z-10 bg-white border-r pr-4">
          <div className="h-16 flex items-center font-semibold text-sm">
            Horaires
            {timeRangeFilter !== 'all' && (
              <span className="ml-2 text-xs text-gray-500">
                ({timeRangeFilter === '0-8' ? '0h-8h' : timeRangeFilter === '8-16' ? '8h-16h' : '16h-24h'})
              </span>
            )}
          </div>
          {slots.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-xs text-gray-400 border-b">
              Aucun créneau dans cette plage horaire
            </div>
          ) : (
            slots.map((slot, index) => (
              <div
                key={index}
                className="h-20 flex items-center justify-end text-xs text-gray-600 pr-2 border-b"
              >
                <div className="text-right">
                  <div className="font-medium">{slot.label}</div>
                  <div className="text-[10px] text-gray-400">({slot.duration}min)</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Colonnes pour chaque terrain */}
        {courts.map((court) => (
          <div key={court.id} className="flex flex-col">
            {/* En-tête du terrain */}
            <div className="h-16 flex items-center justify-center font-semibold text-sm border-b bg-gray-50">
              <div className="text-center">
                <div className="font-bold">Terrain {court.numero}</div>
                <div className="text-xs text-gray-500">{court.nom}</div>
              </div>
            </div>

            {/* Slots pour ce terrain */}
            {slots.length === 0 ? (
              <div className="h-20 flex items-center justify-center text-xs text-gray-400 border-b">
                -
              </div>
            ) : (
              slots.map((slot, index) => {
                const { status, booking, blockReason } = getSlotStatus(slot, court.id)
                // En mode admin, tous les créneaux occupés sont cliquables (sauf passés et bloqués)
                const isClickable = status === 'available' || status === 'my-booking' || (isAdmin && (status === 'occupied' || status === 'my-participation'))
                const canCancel = (status === 'my-booking' || status === 'my-participation') && onCancelBooking && booking
                const canClickBooking = isAdmin && booking && onBookingClick && status !== 'past' && status !== 'blocked'
                
                return (
                <div
                  key={index}
                  className={`h-20 min-h-[80px] border-b border-r flex items-stretch text-xs transition-colors ${getSlotColor(status)} relative group overflow-hidden`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full h-full p-0 ${!isClickable && !canClickBooking && status !== 'my-participation' ? 'cursor-not-allowed' : ''}`}
                    disabled={(!isClickable && !canClickBooking && status !== 'my-participation') || status === 'past' || status === 'blocked'}
                    onClick={() => {
                      if (canClickBooking && booking) {
                        // En mode admin, cliquer sur une réservation existante ouvre le dialog d'édition
                        onBookingClick(booking)
                      } else if (isClickable) {
                        // Cliquer sur un créneau libre ouvre le dialog de création
                        onSlotClick(slot, court.id)
                      }
                    }}
                  >
                    <div className="flex flex-col items-center justify-center w-full h-full px-0.5 py-0.5 min-w-0">
                      {(!booking || !booking.participants || booking.participants.length === 0) && (
                        <div className="font-semibold text-[10px] leading-tight text-center">
                          {getSlotText(status, booking, blockReason)}
                        </div>
                      )}
                      {booking && booking.participants && booking.participants.length > 0 && (
                        <>
                          <div className="font-semibold text-[9px] leading-[1.1] mb-0.5 whitespace-nowrap shrink-0">
                            {getSlotText(status, booking, blockReason)}
                          </div>
                          <div className="flex flex-col items-center justify-center gap-0 w-full flex-1 min-h-0 overflow-hidden">
                            {booking.participants.map((participant, idx) => {
                              // Format court : Prénom N. (première lettre du nom)
                              const shortName = `${participant.user.prenom} ${participant.user.nom.charAt(0).toUpperCase()}.`
                              return (
                                <div 
                                  key={idx} 
                                  className="text-[9px] leading-[1.2] font-medium opacity-95 truncate w-full text-center px-0.5"
                                  title={`${participant.user.prenom} ${participant.user.nom}`}
                                  style={{ maxHeight: '18px' }}
                                >
                                  {shortName}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </Button>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-800 z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (booking && onCancelBooking) {
                          onCancelBooking(booking.id)
                        }
                      }}
                      title="Annuler ma participation"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

