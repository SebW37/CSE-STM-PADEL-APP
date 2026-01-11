'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, User, Ticket } from 'lucide-react'
import { format } from 'date-fns'

interface Booking {
  id: string
  date: string
  court: {
    numero: number
    nom: string
  }
  utiliseTickets?: boolean
  ticketsUtilises?: number
  participants?: {
    user: {
      id: string
      nom: string
      prenom: string
    }
  }[]
  user?: {
    nom: string
    prenom: string
  }
  isParticipant?: boolean
  organizerName?: string
}

interface Participation {
  id: string
  booking: Booking & {
    user: {
      nom: string
      prenom: string
    }
  }
}

interface User {
  nom: string
  prenom: string
  email: string
  soldeTickets: number
  bookings: Booking[]
  participations?: Participation[]
}

interface DashboardHeaderProps {
  user: User
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  // Combiner les réservations où l'utilisateur est organisateur et participant
  const bookingsAsOrganizer = user.bookings || []
  const bookingsAsParticipant = user.participations?.map(p => ({
    ...p.booking,
    isParticipant: true,
    organizerName: `${p.booking.user.prenom} ${p.booking.user.nom}`
  })) || []
  
  // Fusionner et trier par date, en évitant les doublons
  // (si l'utilisateur est organisateur ET participant de la même réservation, on garde seulement la version organisateur)
  const organizerIds = new Set(bookingsAsOrganizer.map(b => b.id))
  const uniqueParticipantBookings = bookingsAsParticipant.filter(p => !organizerIds.has(p.id))
  
  const allUpcomingBookings = [...bookingsAsOrganizer, ...uniqueParticipantBookings]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const upcomingBookings = allUpcomingBookings
  const nextBooking = upcomingBookings[0]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-4">
        {/* Logo et titre */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">STM</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">CSE STMicroelectronics</h1>
              <p className="text-sm text-gray-500">Réservation Padel</p>
            </div>
          </div>
        </div>

        {/* Profil utilisateur */}
        <div className="flex items-center gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold">{user.prenom} {user.nom}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Résumé des réservations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-2">Réservations à venir</div>
                <div className="text-2xl font-bold mb-2">{upcomingBookings.length}</div>
                {upcomingBookings.length > 0 && (
                  <div className="space-y-1">
                    {upcomingBookings.slice(0, 3).map((booking: Booking) => (
                      <div key={booking.id} className="text-xs text-gray-600 border-l-2 border-blue-200 pl-2 py-1">
                        <div className="font-medium">
                          {format(new Date(booking.date), 'dd/MM à HH:mm')} - Terrain {booking.court.numero}
                        </div>
                        {booking.isParticipant && booking.organizerName && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Organisé par {booking.organizerName}
                          </div>
                        )}
                        {booking.utiliseTickets && (
                          <div className="text-[10px] text-orange-600 mt-0.5">
                            ⚠️ Avec tickets (à remplacer)
                          </div>
                        )}
                      </div>
                    ))}
                    {upcomingBookings.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{upcomingBookings.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-sm text-gray-500">Solde de tickets</div>
                <div className="text-2xl font-bold">{user.soldeTickets}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {nextBooking && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Prochaine réservation</div>
                  <div className="text-sm font-semibold">
                    Terrain {nextBooking.court.numero}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(nextBooking.date)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


