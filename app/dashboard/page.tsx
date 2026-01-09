'use client'

import { useState, useEffect } from 'react'
import { DashboardHeader } from '@/components/planning/DashboardHeader'
import { PlanningGrid } from '@/components/planning/PlanningGrid'
import { BookingDialog } from '@/components/planning/BookingDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'

interface Booking {
  id: string
  userId: string
  courtId: string
  date: string
  duree: number
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

interface User {
  id: string
  nom: string
  prenom: string
  email: string
  soldeTickets: number
  bookings: Booking[]
}

interface AvailableUser {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [courts, setCourts] = useState<Court[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ slot: any; courtId: string; courtName: string } | null>(null)
  const [blockedSlots, setBlockedSlots] = useState<any[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [timeRangeFilter, setTimeRangeFilter] = useState<'all' | '0-8' | '8-16' | '16-24'>('all')

  // S'assurer que la date sélectionnée n'est pas dans le passé
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const selectedDateStart = new Date(selectedDate)
    selectedDateStart.setHours(0, 0, 0, 0)

    // Si la date est dans le passé, revenir à aujourd'hui
    if (selectedDateStart < today) {
      setSelectedDate(new Date())
      return
    }
  }, [selectedDate])

  // Charger les données
  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Charger l'utilisateur
      const userRes = await fetch('/api/user')
      if (!userRes.ok) throw new Error('Erreur lors du chargement de l\'utilisateur')
      const userData = await userRes.json()
      setUser(userData.user)
      setCurrentUserId(userData.user.id)

      // Charger les terrains
      const courtsRes = await fetch('/api/courts')
      if (!courtsRes.ok) throw new Error('Erreur lors du chargement des terrains')
      const courtsData = await courtsRes.json()
      setCourts(courtsData.courts)

      // Charger tous les utilisateurs disponibles
      const usersRes = await fetch('/api/users')
      if (!usersRes.ok) throw new Error('Erreur lors du chargement des utilisateurs')
      const usersData = await usersRes.json()
      setAvailableUsers(usersData.users)

      // Charger les réservations pour la semaine
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
      
      const bookingsRes = await fetch(
        `/api/bookings?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
      )
      if (!bookingsRes.ok) {
        const errorData = await bookingsRes.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Erreur lors du chargement des réservations')
      }
      const bookingsData = await bookingsRes.json()
      setBookings(bookingsData.bookings || [])
      setCurrentUserId(bookingsData.currentUserId)

      // Charger les blocages de plages horaires pour la semaine
      const blocksRes = await fetch(
        `/api/time-slots?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
      )
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json()
        setBlockedSlots(blocksData.blocks || [])
      }

    } catch (err: any) {
      setError(err.message)
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSlotClick = (slot: any, courtId: string) => {
    const court = courts.find(c => c.id === courtId)
    if (!court) return

    setSelectedSlot({
      slot,
      courtId,
      courtName: `Terrain ${court.numero} - ${court.nom}`
    })
    setBookingDialogOpen(true)
  }

  const handleBookingConfirm = async (participantIds: string[] | null, useTickets?: boolean) => {
    if (!selectedSlot) return

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courtId: selectedSlot.courtId,
          date: selectedSlot.slot.start.toISOString(),
          duree: selectedSlot.slot.duration,
          participantIds: participantIds || [],
          useTickets: useTickets || false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Afficher un message d'erreur plus détaillé
        let errorMessage = data.message || data.error || 'Erreur lors de la réservation'
        
        // Si des détails sont disponibles en développement, les afficher
        if (data.details && process.env.NODE_ENV === 'development') {
          console.error('Détails de l\'erreur:', data.details)
          errorMessage += '\n\nVoir la console pour plus de détails.'
        }
        
        alert(errorMessage)
        console.error('Erreur de réservation:', {
          status: response.status,
          data: data
        })
        return
      }

      alert(useTickets 
        ? 'Réservation confirmée avec 3 tickets ! Vous pouvez remplacer les tickets par des participants jusqu\'à 30 minutes avant la réservation.'
        : 'Réservation confirmée avec succès !'
      )
      setBookingDialogOpen(false)
      setSelectedSlot(null)
      // Recharger les données
      loadData()
    } catch (err: any) {
      alert('Erreur lors de la réservation: ' + err.message)
    }
  }

  const handleBookingClick = async (booking: Booking) => {
    // Si c'est une réservation avec tickets, ouvrir le dialog de modification
    if (booking.utiliseTickets && booking.userId === currentUserId) {
      const bookingDate = new Date(booking.date)
      const now = new Date()
      const timeDiff = bookingDate.getTime() - now.getTime()
      const minutesDiff = timeDiff / (1000 * 60)

      if (minutesDiff < 30) {
        alert('Vous ne pouvez plus modifier cette réservation. La modification doit être faite au moins 30 minutes avant la réservation. Vos tickets sont perdus.')
        return
      }

      // Ouvrir le dialog en mode modification
      setSelectedSlot({
        slot: { start: bookingDate, duration: booking.duree },
        courtId: booking.courtId,
        courtName: `Terrain ${booking.court.numero} - ${booking.court.nom}`
      })
      setBookingDialogOpen(true)
      // TODO: Passer le mode modification au dialog
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    // Demander confirmation
    const confirmMessage = 'Êtes-vous sûr de vouloir annuler votre participation à cette réservation ?\n\nSi vous êtes l\'organisateur, toute la réservation sera annulée.\nSi vous êtes un participant et qu\'il ne reste plus assez de participants, la réservation sera annulée.'
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || data.error || 'Erreur lors de l\'annulation')
        return
      }

      alert(data.message || 'Participation annulée avec succès')
      // Recharger les données
      loadData()
    } catch (err: any) {
      alert('Erreur lors de l\'annulation: ' + err.message)
    }
  }

  // Calculer les limites de navigation (pas de limite, sauf le passé)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const canGoPrevious = () => {
    const selectedDateStart = new Date(selectedDate)
    selectedDateStart.setHours(0, 0, 0, 0)
    return selectedDateStart > today
  }

  const canGoNext = () => {
    // Pas de limite pour aller dans le futur
    return true
  }

  const goToPreviousDay = () => {
    if (canGoPrevious()) {
      setSelectedDate(subDays(selectedDate, 1))
    }
  }

  const goToNextDay = () => {
    if (canGoNext()) {
      setSelectedDate(addDays(selectedDate, 1))
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Erreur: {error}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Utilisateur non trouvé</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <DashboardHeader user={user} />

      {/* Sélecteur de date */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Planning des réservations
            </div>
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "d MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        // Vérifier que la date n'est pas dans le passé
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)

                        const selectedDateStart = new Date(date)
                        selectedDateStart.setHours(0, 0, 0, 0)

                        if (selectedDateStart >= today) {
                          setSelectedDate(date)
                          setCalendarOpen(false)
                        }
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)

                      const dateStart = new Date(date)
                      dateStart.setHours(0, 0, 0, 0)

                      return dateStart < today
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={goToPreviousDay} disabled={!canGoPrevious()}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextDay} disabled={!canGoNext()}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <div className="text-2xl font-bold">
              {selectedDate.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>

          {/* Filtre par plage horaire */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-sm font-medium">Plage horaire :</span>
            <div className="flex gap-2">
              <Button
                variant={timeRangeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRangeFilter('all')}
              >
                Toute la journée
              </Button>
              <Button
                variant={timeRangeFilter === '0-8' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRangeFilter('0-8')}
              >
                0h - 8h
              </Button>
              <Button
                variant={timeRangeFilter === '8-16' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRangeFilter('8-16')}
              >
                8h - 16h
              </Button>
              <Button
                variant={timeRangeFilter === '16-24' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRangeFilter('16-24')}
              >
                16h - 24h
              </Button>
            </div>
          </div>

          {/* Légende */}
          <div className="flex flex-wrap gap-4 justify-center mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>Passé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 rounded"></div>
              <span>Occupé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 rounded"></div>
              <span>Ma réservation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-indigo-100 rounded"></div>
              <span>Je participe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded"></div>
              <span>Bloqué</span>
            </div>
          </div>

          {/* Grille de planning */}
          <PlanningGrid
            date={selectedDate}
            courts={courts}
            bookings={bookings}
            currentUserId={currentUserId}
            onSlotClick={handleSlotClick}
            onCancelBooking={handleCancelBooking}
            onBookingClick={handleBookingClick}
            blockedSlots={blockedSlots}
            timeRangeFilter={timeRangeFilter}
          />
        </CardContent>
      </Card>

      {/* Dialog de réservation */}
      {selectedSlot && (
        <BookingDialog
          open={bookingDialogOpen}
          onClose={() => {
            setBookingDialogOpen(false)
            setSelectedSlot(null)
          }}
          onConfirm={handleBookingConfirm}
          slotDate={selectedSlot.slot.start}
          slotDuration={selectedSlot.slot.duration}
          courtName={selectedSlot.courtName}
          availableUsers={availableUsers}
          currentUserId={currentUserId}
          currentUserTickets={user?.soldeTickets || 0}
        />
      )}
    </div>
  )
}

