'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, X } from 'lucide-react'
import { format } from 'date-fns'

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
}

interface BookingDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (participantIds: string[] | null, useTickets?: boolean) => void
  slotDate: Date
  slotDuration: number
  courtName: string
  availableUsers: User[]
  currentUserId: string
  currentUserTickets?: number // Nombre de tickets disponibles
  isAdmin?: boolean // Mode admin : permet de sélectionner librement l'organisateur
  isModifyMode?: boolean // Mode modification : pour remplacer tickets par participants
  bookingId?: string // ID de la réservation à modifier
}

export function BookingDialog({
  open,
  onClose,
  onConfirm,
  slotDate,
  slotDuration,
  courtName,
  availableUsers,
  currentUserId,
  currentUserTickets = 0,
  isAdmin = false,
  isModifyMode = false,
  bookingId
}: BookingDialogProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(isAdmin ? [] : [currentUserId])
  const [searchTerm, setSearchTerm] = useState('')
  const [useTickets, setUseTickets] = useState(false)

  // S'assurer que l'utilisateur actuel est toujours sélectionné (sauf en mode admin)
  useEffect(() => {
    if (!isAdmin && currentUserId && !selectedParticipants.includes(currentUserId)) {
      setSelectedParticipants([currentUserId, ...selectedParticipants.filter(id => id !== currentUserId)])
    }
  }, [currentUserId, isAdmin])

  const filteredUsers = availableUsers.filter(user =>
    (isAdmin || user.id !== currentUserId) &&
    (user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.matricule.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const toggleParticipant = (userId: string) => {
    // En mode admin, on peut désélectionner n'importe qui
    // En mode normal, on ne peut pas désélectionner l'organisateur
    if (!isAdmin && userId === currentUserId) {
      return // Ne pas permettre de désélectionner l'organisateur
    }

    if (selectedParticipants.includes(userId)) {
      // Si c'est le premier (organisateur) et qu'il y a d'autres participants, ne pas le retirer
      if (!isAdmin && userId === currentUserId && selectedParticipants.length > 1) {
        return
      }
      setSelectedParticipants(selectedParticipants.filter(id => id !== userId))
    } else {
      if (selectedParticipants.length < 4) {
        // En mode admin, le premier sélectionné devient l'organisateur
        setSelectedParticipants([...selectedParticipants, userId])
      }
    }
  }

  const handleConfirm = () => {
    if (useTickets) {
      // Mode tickets : pas de participants, juste confirmer avec tickets
      onConfirm(null, true)
      setSelectedParticipants(isAdmin ? [] : [currentUserId])
      setSearchTerm('')
      setUseTickets(false)
    } else if (selectedParticipants.length === 4) {
      // Mode participants : 4 participants requis
      onConfirm(selectedParticipants, false)
      setSelectedParticipants(isAdmin ? [] : [currentUserId])
      setSearchTerm('')
      setUseTickets(false)
    }
  }

  const canUseTickets = currentUserTickets >= 3 && !isModifyMode

  const currentUser = availableUsers.find(u => u.id === currentUserId)
  const organizerId = isAdmin ? selectedParticipants[0] : currentUserId
  const organizer = availableUsers.find(u => u.id === organizerId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isModifyMode ? 'Modifier la réservation' : 'Nouvelle réservation'}</DialogTitle>
          <DialogDescription>
            {isModifyMode 
              ? `Remplacez les tickets par 4 participants pour la réservation du ${format(slotDate, 'dd/MM/yyyy à HH:mm')}`
              : `Sélectionnez 4 participants ou utilisez 3 tickets pour la réservation du ${format(slotDate, 'dd/MM/yyyy à HH:mm')}`
            }
            <br />
            <span className="font-medium">Terrain: {courtName}</span> - Durée: {slotDuration} minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Option tickets (uniquement si pas en mode modification et assez de tickets) */}
          {!isModifyMode && canUseTickets && (
            <div className="p-4 border rounded-lg bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="useTickets"
                  checked={useTickets}
                  onChange={(e) => {
                    setUseTickets(e.target.checked)
                    if (e.target.checked) {
                      setSelectedParticipants([])
                    }
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="useTickets" className="text-sm font-medium cursor-pointer">
                  Réserver avec 3 tickets (sans participants pour l'instant)
                </label>
              </div>
              <p className="text-xs text-gray-600 ml-6">
                Vous pourrez remplacer les tickets par des participants jusqu'à 30 minutes avant la réservation.
                Vos tickets disponibles : {currentUserTickets}
              </p>
            </div>
          )}

          {!useTickets && (
            <>
          {/* Participants sélectionnés */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Participants sélectionnés ({selectedParticipants.length}/4)
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedParticipants.map((userId, index) => {
                const user = availableUsers.find(u => u.id === userId)
                if (!user) return null
                const isOrganizer = index === 0 // Le premier est toujours l'organisateur
                const canRemove = isAdmin || (!isOrganizer && userId !== currentUserId)
                return (
                  <Badge
                    key={userId}
                    variant={isOrganizer ? 'default' : 'secondary'}
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    <User className="w-3 h-3" />
                    {user.prenom} {user.nom}
                    {isOrganizer && <span className="text-xs">(Organisateur)</span>}
                    {canRemove && (
                      <button
                        onClick={() => toggleParticipant(userId)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Recherche */}
          <div>
            <label className="text-sm font-medium mb-2 block">Rechercher un participant</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom, prénom, email ou matricule..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Liste des utilisateurs disponibles */}
          <div>
            <label className="text-sm font-medium mb-2 block">Utilisateurs disponibles</label>
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Aucun utilisateur trouvé
                </div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map(user => {
                    const isSelected = selectedParticipants.includes(user.id)
                    const canSelect = selectedParticipants.length < 4 || isSelected
                    return (
                      <button
                        key={user.id}
                        onClick={() => canSelect && toggleParticipant(user.id)}
                        disabled={!canSelect && !isSelected}
                        className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        } ${!canSelect && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {user.prenom} {user.nom}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.email} • Matricule: {user.matricule}
                            </div>
                          </div>
                          {isSelected && (
                            <Badge variant="default" className="ml-2">
                              Sélectionné
                            </Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!useTickets && selectedParticipants.length !== 4}
          >
            {useTickets 
              ? `Confirmer avec 3 tickets`
              : `Confirmer la réservation (${selectedParticipants.length}/4)`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

