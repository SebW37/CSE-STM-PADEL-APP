'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { History, Download } from 'lucide-react'
import { format } from 'date-fns'

interface Booking {
  id: string
  date: string
  duree: number
  statut: string
  ticketsUtilises?: number
  utiliseTickets?: boolean
  createdAt: string
  user: {
    nom: string
    prenom: string
    email: string
  }
  court: {
    numero: number
    nom: string
  }
  participants: {
    user: {
      nom: string
      prenom: string
    }
  }[]
}

export function BookingsHistoryPanel() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    loadHistory()
  }, [dateFilter])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const url = dateFilter !== 'all'
        ? `/api/admin/bookings/history?filter=${dateFilter}`
        : '/api/admin/bookings/history'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setBookings(data.bookings)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement de l\'historique')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/export?month=all')
      if (!response.ok) throw new Error('Erreur lors de l\'export')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reservations_historique_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      alert('Erreur lors de l\'export: ' + error.message)
    }
  }

  if (loading) {
    return <div className="text-center p-4">Chargement...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <CardTitle>Historique des Réservations</CardTitle>
            </div>
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border rounded-md"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="year">Cette année</option>
              </select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </div>
          <CardDescription>
            Historique complet de toutes les réservations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bookings.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                Aucune réservation dans l'historique
              </div>
            ) : (
              bookings.map((booking) => (
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
                        <div>
                          {booking.utiliseTickets ? (
                            <span className="font-medium">Tickets utilisés:</span>
                          ) : (
                            <span className="font-medium">Participants:</span>
                          )}
                          {booking.utiliseTickets ? (
                            <span>{booking.ticketsUtilises ?? 0}</span>
                          ) : (
                            <span>{booking.participants?.length ?? 0}/4</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Créée le: {format(new Date(booking.createdAt), 'dd/MM/yyyy à HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

