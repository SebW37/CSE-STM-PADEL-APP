'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ticket, Plus, Minus } from 'lucide-react'

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  soldeTickets: number
}

export function TicketsManagementPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [ticketAmount, setTicketAmount] = useState(10)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/members?limit=100')
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTickets = async (userId: string, operation: 'add' | 'set') => {
    try {
      const user = users.find(u => u.id === userId)
      if (!user) return

      let newTickets: number
      if (operation === 'add') {
        newTickets = user.soldeTickets + ticketAmount
      } else {
        newTickets = ticketAmount
      }

      const response = await fetch(`/api/admin/users/${userId}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: newTickets })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert(`Tickets ${operation === 'add' ? 'ajoutés' : 'définis'} avec succès`)
      loadUsers()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
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
            <Ticket className="w-5 h-5" />
            <CardTitle>Gestion des Tickets</CardTitle>
          </div>
          <CardDescription>
            Ajouter ou définir les tickets des utilisateurs (3 tickets nécessaires pour réserver sans participants)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="text-sm font-medium mb-2 block">
              Nombre de tickets à ajouter/définir
            </label>
            <input
              type="number"
              value={ticketAmount}
              onChange={(e) => setTicketAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md"
              min="0"
            />
          </div>

          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {user.prenom} {user.nom}
                    </h3>
                    <div className="text-sm text-gray-600">
                      {user.email} • Matricule: {user.matricule}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Ticket className="w-4 h-4" />
                      <span className="font-medium">Solde actuel: {user.soldeTickets} tickets</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateTickets(user.id, 'add')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Ajouter {ticketAmount}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateTickets(user.id, 'set')}
                    >
                      Définir à {ticketAmount}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

