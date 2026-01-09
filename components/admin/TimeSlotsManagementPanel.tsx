'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Clock, Plus, Edit, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface TimeSlotBlock {
  id: string
  courtId: string | null
  date: string
  startTime: string
  endTime: string
  raison: string | null
  actif: boolean
  court: {
    numero: number
    nom: string
  } | null
}

interface Court {
  id: string
  numero: number
  nom: string
}

export function TimeSlotsManagementPanel() {
  const [blocks, setBlocks] = useState<TimeSlotBlock[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeSlotBlock | null>(null)
  const [formData, setFormData] = useState({
    courtId: '',
    date: '',
    startTime: '08:00',
    endTime: '20:00',
    raison: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [blocksRes, courtsRes] = await Promise.all([
        fetch('/api/admin/time-slots'),
        fetch('/api/courts')
      ])
      
      if (!blocksRes.ok || !courtsRes.ok) throw new Error('Erreur lors du chargement')
      
      const blocksData = await blocksRes.json()
      const courtsData = await courtsRes.json()
      
      setBlocks(blocksData.blocks)
      setCourts(courtsData.courts)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBlock = () => {
    setEditingBlock(null)
    setFormData({
      courtId: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '20:00',
      raison: ''
    })
    setDialogOpen(true)
  }

  const handleEditBlock = (block: TimeSlotBlock) => {
    setEditingBlock(block)
    setFormData({
      courtId: block.courtId || '',
      date: new Date(block.date).toISOString().split('T')[0],
      startTime: block.startTime,
      endTime: block.endTime,
      raison: block.raison || ''
    })
    setDialogOpen(true)
  }

  const handleSaveBlock = async () => {
    try {
      const url = editingBlock
        ? `/api/admin/time-slots/${editingBlock.id}`
        : '/api/admin/time-slots'
      
      const method = editingBlock ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: formData.courtId || null,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          raison: formData.raison || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert(editingBlock ? 'Blocage modifié' : 'Blocage créé')
      setDialogOpen(false)
      loadData()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce blocage ?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/time-slots/${blockId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert('Blocage supprimé')
      loadData()
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <CardTitle>Gestion des Plages Horaires</CardTitle>
            </div>
            <Button onClick={handleCreateBlock}>
              <Plus className="w-4 h-4 mr-2" />
              Bloquer une plage horaire
            </Button>
          </div>
          <CardDescription>
            Bloquer des plages horaires pour maintenance, événements, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {blocks.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                Aucun blocage de plage horaire
              </div>
            ) : (
              blocks.map((block) => (
                <Card key={block.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4" />
                        <h3 className="font-semibold">
                          {format(new Date(block.date), 'dd/MM/yyyy')}
                        </h3>
                        <Badge variant={block.actif ? 'default' : 'secondary'}>
                          {block.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Plage horaire:</span>{' '}
                          {block.startTime} - {block.endTime}
                        </div>
                        <div>
                          <span className="font-medium">Terrain:</span>{' '}
                          {block.court ? `Terrain ${block.court.numero} - ${block.court.nom}` : 'Tous les terrains'}
                        </div>
                        {block.raison && (
                          <div>
                            <span className="font-medium">Raison:</span> {block.raison}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBlock(block)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? 'Modifier le blocage' : 'Créer un blocage de plage horaire'}
            </DialogTitle>
            <DialogDescription>
              Définissez une plage horaire à bloquer pour tous les terrains ou un terrain spécifique
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              <label className="text-sm font-medium">Terrain (laisser vide pour tous)</label>
              <select
                value={formData.courtId}
                onChange={(e) => setFormData({ ...formData, courtId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="">Tous les terrains</option>
                {courts.map(court => (
                  <option key={court.id} value={court.id}>
                    Terrain {court.numero} - {court.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Heure de début</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Heure de fin</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Raison (optionnel)</label>
              <input
                type="text"
                value={formData.raison}
                onChange={(e) => setFormData({ ...formData, raison: e.target.value })}
                placeholder="Ex: Maintenance, Événement..."
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveBlock}>
              {editingBlock ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

