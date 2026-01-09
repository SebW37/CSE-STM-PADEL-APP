'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Download, Calendar } from 'lucide-react'
import { format, subMonths, addMonths } from 'date-fns'

interface CourtStat {
  courtId: string
  courtNumero: number
  courtNom: string
  totalSlots: number
  occupiedSlots: number
  occupationRate: number
  totalBookings: number
}

interface Statistics {
  period: {
    start: string
    end: string
    month: string
  }
  courts: CourtStat[]
  global: {
    totalBookings: number
    totalUsers: number
    activeUsers: number
    averageOccupationRate: number
  }
}

export function StatisticsPanel() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  useEffect(() => {
    loadStatistics()
  }, [selectedMonth])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const monthStr = format(selectedMonth, 'yyyy-MM')
      const response = await fetch(`/api/admin/stats?month=${monthStr}`)
      if (!response.ok) throw new Error('Erreur lors du chargement')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const monthStr = format(selectedMonth, 'yyyy-MM')
      const response = await fetch(`/api/admin/export?month=${monthStr}`)
      if (!response.ok) throw new Error('Erreur lors de l\'export')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reservations_${monthStr}.csv`
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

  if (!stats) {
    return <div className="text-center p-4">Aucune donnée disponible</div>
  }

  // Préparer les données pour le graphique
  const chartData = stats.courts.map(court => ({
    name: `Terrain ${court.courtNumero}`,
    'Taux occupation (%)': court.occupationRate,
    'Réservations': court.totalBookings
  }))

  return (
    <div className="space-y-4">
      {/* Sélecteur de mois et export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <CardTitle>Statistiques d'Occupation</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              >
                ←
              </Button>
              <div className="flex items-center gap-2 px-4">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">{stats.period.month}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                disabled={format(selectedMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM')}
              >
                →
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExport}
                className="ml-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
          </div>
          <CardDescription>
            Taux d'occupation des 3 terrains sur le mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Graphique */}
          <div className="h-80 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Taux occupation (%)" fill="#3b82f6" />
                <Bar dataKey="Réservations" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Statistiques globales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total réservations</div>
                <div className="text-2xl font-bold">{stats.global.totalBookings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Utilisateurs actifs</div>
                <div className="text-2xl font-bold">{stats.global.activeUsers}</div>
                <div className="text-xs text-gray-500">sur {stats.global.totalUsers} membres</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Taux moyen d'occupation</div>
                <div className="text-2xl font-bold">
                  {Math.round(stats.global.averageOccupationRate)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Période</div>
                <div className="text-sm font-medium">{stats.period.month}</div>
              </CardContent>
            </Card>
          </div>

          {/* Détails par terrain */}
          <div className="space-y-2">
            <h3 className="font-semibold">Détails par terrain</h3>
            {stats.courts.map((court) => (
              <Card key={court.courtId} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      Terrain {court.courtNumero} - {court.courtNom}
                    </div>
                    <div className="text-sm text-gray-500">
                      {court.occupiedSlots} slots occupés sur {court.totalSlots} disponibles
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{court.occupationRate.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">{court.totalBookings} réservations</div>
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

