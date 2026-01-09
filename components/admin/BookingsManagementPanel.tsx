'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlanningGrid } from '@/components/planning/PlanningGrid'
import { BookingDialog } from '@/components/planning/BookingDialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon, X, Edit, Search, Plus, ChevronLeft, ChevronRight, Grid3x3, List } from 'lucide-react'
import { format, addDays, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Booking {
  id: string
  userId: string
  courtId: string
  date: string
  duree: number
  statut: string
  user: {
    id: string
    nom: string
    prenom: string
    email: string
  }
  court: {
    id: string
    numero: number
    nom: string
  }
  participants: {
    user: {
      id: string
      nom: string
      prenom: string
    }
  }[]
}

export function BookingsManagementPanel() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [courts, setCourts] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [blockedSlots, setBlockedSlots] = useState<any[]>([])
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ slot: any; courtId: string; courtName: string } | null>(null)
  const [timeRangeFilter, setTimeRangeFilter] = useState<'all' | '0-8' | '8-16' | '16-24'>('all')

  useEffect(() => {
    loadBookings()
    loadCourtsAndUsers()
  }, [filterStatus])

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadCalendarData()
    }
  }, [selectedDate, viewMode])

  const loadCalendarData = async () => {
    try {
      const startDate = new Date(selectedDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(selectedDate)
      endDate.setHours(23, 59, 59, 999)

      const [courtsRes, bookingsRes, usersRes, blockedRes] = await Promise.all([
        fetch('/api/courts'),
        fetch(`/api/admin/bookings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`),
        fetch('/api/users'),
        fetch(`/api/time-slots?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`)
      ])

      if (courtsRes.ok) {
        const courtsData = await courtsRes.json()
        setCourts(courtsData.courts || [])
      }

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookings(bookingsData.bookings || [])
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setAvailableUsers(usersData.users || [])
      }

      if (blockedRes.ok) {
        const blockedData = await blockedRes.json()
        setBlockedSlots(blockedData.blocks || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données calendrier:', error)
    }
  }

  const loadCourtsAndUsers = async () => {
    try {
      const [courtsRes, usersRes] = await Promise.all([
        fetch('/api/courts'),
        fetch('/api/users')
      ])
      if (courtsRes.ok) {
        const courtsData = await courtsRes.json()
        setCourts(courtsData.courts)
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users)
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const loadBookings = async () => {
    try {
      setLoading(true)
      const url = filterStatus !== 'all' 
        ? `/api/admin/bookings?status=${filterStatus}`
        : '/api/admin/bookings'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setBookings(data.bookings)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des réservations')
    } finally {
      setLoading(false)
    }
  }

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    userId: '',
    courtId: '',
    date: '',
    time: '',
    duree: 60,
    participantIds: [] as string[]
  })

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking)
    const bookingDate = new Date(booking.date)
    setFormData({
      userId: booking.userId,
      courtId: booking.courtId,
      date: bookingDate.toISOString().split('T')[0],
      time: `${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`,
      duree: booking.duree,
      participantIds: booking.participants?.map(p => p.user.id) || []
    })
    setEditDialogOpen(true)
  }

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase()
    return (
      booking.user.nom.toLowerCase().includes(searchLower) ||
      booking.user.prenom.toLowerCase().includes(searchLower) ||
      booking.user.email.toLowerCase().includes(searchLower) ||
      booking.court.nom.toLowerCase().includes(searchLower)
    )
  })

  const handleSlotClick = (slot: any, courtId: string) => {
    const court = courts.find(c => c.id === courtId)
    setSelectedSlot({
      slot,
      courtId,
      courtName: court ? `Terrain ${court.numero}` : ''
    })
    setBookingDialogOpen(true)
  }

  const handleBookingConfirm = async (participantIds: string[]) => {
    if (!selectedSlot) return

    try {
      const bookingDate = new Date(selectedSlot.slot.start)
      const court = courts.find(c => c.id === selectedSlot.courtId)
      
      if (!court) {
        alert('Terrain non trouvé')
        return
      }

      // Le premier participant est l'organisateur
      const userId = participantIds[0]
      
      if (participantIds.length !== 4) {
        alert('4 participants requis')
        return
      }

      const response = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          courtId: selectedSlot.courtId,
          date: bookingDate.toISOString(),
          duree: selectedSlot.slot.duration,
          participantIds,
          skipValidation: true // Admin peut bypasser les validations
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur lors de la création')
      }

      alert('Réservation créée avec succès')
      setBookingDialogOpen(false)
      setSelectedSlot(null)
      loadCalendarData()
      loadBookings()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur lors de la suppression')
      }

      alert('Réservation supprimée avec succès')
      loadCalendarData()
      loadBookings()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const canGoPrevious = () => {
    const selectedDateStart = new Date(selectedDate)
    selectedDateStart.setHours(0, 0, 0, 0)
    return selectedDateStart > today
  }

  const canGoNext = () => true // Pas de limite pour les admins

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

  if (loading && viewMode === 'list') {
    return <div className="text-center p-4">Chargement...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          {/* Titre et description */}
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-5 h-5" />
            <CardTitle>Gestion des Réservations</CardTitle>
          </div>
          <CardDescription>
            Consulter, modifier et annuler les réservations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Boutons de vue - Déplacés dans CardContent */}
          <div className="flex items-center gap-2 border-b pb-4">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <Grid3x3 className="w-4 h-4 mr-2" />
              Calendrier
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              Liste
            </Button>
          </div>

          {viewMode === 'calendar' ? (
            <div className="space-y-6">
              {/* Section Navigation Date */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Sélection de la date</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={goToPreviousDay} disabled={!canGoPrevious()}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="relative">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "min-w-[220px] justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedDate(date)
                            }
                          }}
                          initialFocus
                          locale={fr}
                          fromDate={today}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToNextDay} disabled={!canGoNext()}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Aujourd'hui
                  </Button>
                </div>
              </div>

              {/* Section Filtre Plage Horaire */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Plage horaire</div>
                <div className="flex items-center gap-2 flex-wrap">
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

              {/* Section Légende */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">Légende</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0"></div>
                    <span>Passé</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded flex-shrink-0"></div>
                    <span>Occupé</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 rounded flex-shrink-0"></div>
                    <span>Libre</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-200 rounded flex-shrink-0"></div>
                    <span>Bloqué</span>
                  </div>
                </div>
              </div>

              {/* Grille de planning */}
              <PlanningGrid
                date={selectedDate}
                courts={courts}
                bookings={bookings.map(b => ({
                  ...b,
                  date: b.date
                }))}
                currentUserId="" // Pas de currentUserId pour les admins
                onSlotClick={handleSlotClick}
                onCancelBooking={handleCancelBooking}
                onBookingClick={handleEditBooking} // Permet de cliquer sur une réservation pour l'éditer
                blockedSlots={blockedSlots}
                timeRangeFilter={timeRangeFilter}
                isAdmin={true} // Mode admin activé
              />
            </div>
          ) : (
            <div>
              {/* Filtres */}
              <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email ou terrain..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="CONFIRME">Confirmées</option>
              <option value="ANNULE">Annulées</option>
              <option value="TERMINE">Terminées</option>
            </select>
              </div>

              {/* Liste des réservations */}
              <div className="space-y-2">
            {filteredBookings.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                Aucune réservation trouvée
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <Card key={booking.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">
                          Terrain {booking.court.numero} - {booking.court.nom}
                        </h3>
                        <Badge
                          variant={
                            booking.statut === 'CONFIRME'
                              ? 'default'
                              : booking.statut === 'ANNULE'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {booking.statut}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Date:</span>{' '}
                          {format(new Date(booking.date), 'dd/MM/yyyy à HH:mm')}
                        </div>
                        <div>
                          <span className="font-medium">Durée:</span> {booking.duree} minutes
                        </div>
                        <div>
                          <span className="font-medium">Organisateur:</span>{' '}
                          {booking.user.prenom} {booking.user.nom} ({booking.user.email})
                        </div>
                        {booking.participants && booking.participants.length > 0 && (
                          <div>
                            <span className="font-medium">Participants:</span>{' '}
                            {booking.participants.map((p, idx) => (
                              <span key={idx}>
                                {p.user.prenom} {p.user.nom}
                                {idx < booking.participants!.length - 1 && ', '}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {booking.statut === 'CONFIRME' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditBooking(booking)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Supprimer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création/édition */}
      <Dialog open={editDialogOpen || createDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false)
          setCreateDialogOpen(false)
          setEditingBooking(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBooking ? 'Modifier la réservation' : 'Créer une réservation'}
            </DialogTitle>
            <DialogDescription>
              {editingBooking ? 'Modifiez les détails de la réservation' : 'Créez une nouvelle réservation'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organisateur</label>
              <select
                value={formData.userId}
                onChange={(e) => {
                  const newUserId = e.target.value
                  setFormData({
                    ...formData,
                    userId: newUserId,
                    participantIds: formData.participantIds.includes(newUserId)
                      ? formData.participantIds
                      : [newUserId, ...formData.participantIds.filter(id => id !== newUserId)]
                  })
                }}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Sélectionner un utilisateur</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.prenom} {user.nom} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Terrain</label>
              <select
                value={formData.courtId}
                onChange={(e) => setFormData({ ...formData, courtId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Sélectionner un terrain</option>
                {courts.map(court => (
                  <option key={court.id} value={court.id}>
                    Terrain {court.numero} - {court.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Heure</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Durée (minutes)</label>
              <input
                type="number"
                value={formData.duree}
                onChange={(e) => setFormData({ ...formData, duree: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 border rounded-md mt-1"
                min="30"
                step="30"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Participants ({formData.participantIds.length}/4)
              </label>
              <div className="border rounded-md max-h-60 overflow-y-auto mt-1">
                {users.map(user => {
                  const isSelected = formData.participantIds.includes(user.id)
                  const isOrganizer = user.id === formData.userId
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (isOrganizer) return // Ne pas permettre de désélectionner l'organisateur
                        if (isSelected) {
                          setFormData({
                            ...formData,
                            participantIds: formData.participantIds.filter(id => id !== user.id)
                          })
                        } else {
                          if (formData.participantIds.length < 4) {
                            setFormData({
                              ...formData,
                              participantIds: [...formData.participantIds, user.id]
                            })
                          }
                        }
                      }}
                      disabled={!isSelected && formData.participantIds.length >= 4}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50' : ''
                      } ${!isSelected && formData.participantIds.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {user.prenom} {user.nom}
                            {isOrganizer && <span className="text-xs text-gray-500 ml-1">(Organisateur)</span>}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        {isSelected && <Badge>Sélectionné</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <div>
                {editingBooking && (
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) {
                        return
                      }

                      try {
                        const response = await fetch(`/api/admin/bookings/${editingBooking.id}`, {
                          method: 'DELETE'
                        })

                        if (!response.ok) {
                          const error = await response.json()
                          throw new Error(error.message || 'Erreur lors de la suppression')
                        }

                        alert('Réservation supprimée avec succès')
                        setEditDialogOpen(false)
                        setEditingBooking(null)
                        loadBookings()
                        if (viewMode === 'calendar') {
                          loadCalendarData()
                        }
                      } catch (error: any) {
                        alert('Erreur: ' + error.message)
                      }
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setEditDialogOpen(false)
                  setCreateDialogOpen(false)
                  setEditingBooking(null)
                }}>
                  Annuler
                </Button>
                <Button
                  onClick={async () => {
                    if (!formData.userId || !formData.courtId || !formData.date || !formData.time || formData.participantIds.length !== 4) {
                      alert('Veuillez remplir tous les champs et sélectionner 4 participants')
                      return
                    }

                    try {
                      const dateTime = new Date(`${formData.date}T${formData.time}`)
                      const url = editingBooking
                        ? `/api/admin/bookings/${editingBooking.id}`
                        : '/api/admin/bookings'
                      
                      const method = editingBooking ? 'PATCH' : 'POST'

                      const response = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: formData.userId,
                          courtId: formData.courtId,
                          date: dateTime.toISOString(),
                          duree: formData.duree,
                          participantIds: formData.participantIds
                        })
                      })

                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.message || 'Erreur')
                      }

                      alert(editingBooking ? 'Réservation modifiée' : 'Réservation créée')
                      setEditDialogOpen(false)
                      setCreateDialogOpen(false)
                      setEditingBooking(null)
                      loadBookings()
                      if (viewMode === 'calendar') {
                        loadCalendarData()
                      }
                    } catch (error: any) {
                      alert('Erreur: ' + error.message)
                    }
                  }}
                >
                  {editingBooking ? 'Enregistrer' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de réservation pour la vue calendrier */}
      {selectedSlot && (
        <BookingDialog
          open={bookingDialogOpen}
          onClose={() => {
            setBookingDialogOpen(false)
            setSelectedSlot(null)
          }}
          slotDate={selectedSlot.slot.start}
          slotDuration={selectedSlot.slot.duration}
          courtName={selectedSlot.courtName}
          currentUserId={availableUsers[0]?.id || ""} // Premier utilisateur par défaut pour les admins
          availableUsers={availableUsers}
          onConfirm={(participantIds) => handleBookingConfirm(participantIds)}
          isAdmin={true}
        />
      )}
    </div>
  )
}

