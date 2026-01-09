'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MaintenancePanel } from '@/components/admin/MaintenancePanel'
import { MembersList } from '@/components/admin/MembersList'
import { StatisticsPanel } from '@/components/admin/StatisticsPanel'
import { BookingsManagementPanel } from '@/components/admin/BookingsManagementPanel'
import { UsersManagementPanel } from '@/components/admin/UsersManagementPanel'
import { TicketsManagementPanel } from '@/components/admin/TicketsManagementPanel'
import { BookingsHistoryPanel } from '@/components/admin/BookingsHistoryPanel'
import { TimeSlotsManagementPanel } from '@/components/admin/TimeSlotsManagementPanel'
import { Shield, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      // Vérifier l'accès admin en appelant une route API
      const response = await fetch('/api/admin/check')
      if (response.ok) {
        setIsAdmin(true)
      } else {
        // Rediriger vers le dashboard si pas admin
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Erreur:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Vérification des droits d'accès...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <CardTitle>Accès refusé</CardTitle>
            </div>
            <CardDescription>
              Vous n'avez pas les droits d'administrateur pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Retour au dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Panel d'Administration CSE</h1>
            <p className="text-gray-500">Gestion des terrains, membres et statistiques</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="bookings">Réservations</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="maintenance">Terrains</TabsTrigger>
          <TabsTrigger value="time-slots">Plages horaires</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="statistics">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <BookingsManagementPanel />
        </TabsContent>

        <TabsContent value="users">
          <UsersManagementPanel />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenancePanel />
        </TabsContent>

        <TabsContent value="time-slots">
          <TimeSlotsManagementPanel />
        </TabsContent>

        <TabsContent value="tickets">
          <TicketsManagementPanel />
        </TabsContent>

        <TabsContent value="history">
          <BookingsHistoryPanel />
        </TabsContent>

        <TabsContent value="statistics">
          <StatisticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}


