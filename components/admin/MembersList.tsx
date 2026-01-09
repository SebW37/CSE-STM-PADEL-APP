'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, Ticket } from 'lucide-react'
import { format } from 'date-fns'

interface Booking {
  id: string
  date: string
  duree: number
  statut: string
  court: {
    numero: number
    nom: string
  }
}

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  soldeTickets?: number
  role: string
  createdAt: string
  _count: {
    bookings: number
  }
  bookings: Booking[]
}

export function MembersList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadMembers()
  }, [page])

  const loadMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/members?page=${page}&limit=20`)
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setUsers(data.users)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des membres')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center p-4">Chargement...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <CardTitle>Liste des Membres</CardTitle>
          </div>
          <CardDescription>
            Vue d'ensemble des employés et de leur historique de jeu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                        {user.prenom} {user.nom}
                      </h3>
                      {user.role === 'ADMIN' && (
                        <Badge variant="default">Admin</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium">Matricule:</span> {user.matricule}
                      </div>
                      <div>
                        <span className="font-medium">Email:</span> {user.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Ticket className="w-4 h-4" />
                        <span className="font-medium">Tickets:</span> {user.soldeTickets ?? 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Réservations:</span> {user._count.bookings}
                      </div>
                    </div>

                    {/* Historique récent */}
                    {user.bookings.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Dernières réservations:</h4>
                        <div className="space-y-1">
                          {user.bookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="text-xs text-gray-500 flex items-center gap-2"
                            >
                              <span>
                                {format(new Date(booking.date), 'dd/MM/yyyy à HH:mm')}
                              </span>
                              <span>•</span>
                              <span>Terrain {booking.court.numero}</span>
                              <span>•</span>
                              <Badge
                                variant={
                                  booking.statut === 'CONFIRME'
                                    ? 'default'
                                    : booking.statut === 'ANNULE'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {booking.statut}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Page {page} sur {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


