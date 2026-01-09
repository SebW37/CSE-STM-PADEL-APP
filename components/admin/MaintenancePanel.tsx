'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wrench, CheckCircle, XCircle } from 'lucide-react'

interface Court {
  id: string
  numero: number
  nom: string
  actif: boolean
  _count: {
    bookings: number
  }
}

export function MaintenancePanel() {
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadCourts()
  }, [])

  const loadCourts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/courts')
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setCourts(data.courts)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des terrains')
    } finally {
      setLoading(false)
    }
  }

  const toggleCourtStatus = async (courtId: string, currentStatus: boolean) => {
    try {
      setUpdating(courtId)
      const response = await fetch('/api/admin/courts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courtId,
          actif: !currentStatus
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur lors de la mise à jour')
      }

      const data = await response.json()
      alert(data.message)
      loadCourts()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    } finally {
      setUpdating(null)
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
            <Wrench className="w-5 h-5" />
            <CardTitle>Gestion de la Maintenance</CardTitle>
          </div>
          <CardDescription>
            Activez ou désactivez les terrains pour maintenance ou travaux
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {courts.map((court) => (
              <div
                key={court.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-semibold text-lg">
                      Terrain {court.numero} - {court.nom}
                    </div>
                    <div className="text-sm text-gray-500">
                      {court._count.bookings} réservation(s) à venir
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={court.actif ? 'default' : 'destructive'}>
                    {court.actif ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Actif
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        En maintenance
                      </>
                    )}
                  </Badge>
                  <Button
                    variant={court.actif ? 'destructive' : 'default'}
                    onClick={() => toggleCourtStatus(court.id, court.actif)}
                    disabled={updating === court.id}
                  >
                    {updating === court.id
                      ? 'Mise à jour...'
                      : court.actif
                      ? 'Mettre en maintenance'
                      : 'Réactiver'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


