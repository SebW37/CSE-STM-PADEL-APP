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
  activeBookingsCount?: number
}

interface BookingDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (participantIds: string[] | null, ticketsCount?: number) => void
  slotDate: Date
  slotDuration: number
  courtName: string
  availableUsers: User[]
  currentUserId: string
  currentUserTickets?: number // Nombre de tickets disponibles
  isAdmin?: boolean // Mode admin : permet de sélectionner librement l'organisateur
  isModifyMode?: boolean // Mode modification : pour remplacer tickets par participants
  bookingId?: string // ID de la réservation à modifier
  existingBooking?: {
    ticketsUtilises: number
    participants?: { userId: string }[]
  } // Données de la réservation existante en mode modification
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
  bookingId,
  existingBooking
}: BookingDialogProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(isAdmin ? [] : [currentUserId])
  const [searchTerm, setSearchTerm] = useState('')
  const [ticketsCount, setTicketsCount] = useState<number>(0) // 0 = pas de tickets, 1-3 = nombre de tickets à utiliser

  // En mode modification, initialiser avec les données de la réservation existante
  useEffect(() => {
    if (open) {
      if (isModifyMode && existingBooking) {
        // Initialiser avec les tickets actuels
        if (existingBooking.ticketsUtilises > 0) {
          setTicketsCount(existingBooking.ticketsUtilises)
        } else {
          setTicketsCount(0)
        }
        // Initialiser avec les participants actuels
        if (existingBooking.participants && existingBooking.participants.length > 0) {
          const participantIds = existingBooking.participants.map(p => p.userId).filter(Boolean)
          if (participantIds.length > 0) {
            setSelectedParticipants(participantIds)
          } else {
            setSelectedParticipants(isAdmin ? [] : [currentUserId])
          }
        } else {
          setSelectedParticipants(isAdmin ? [] : [currentUserId])
        }
      } else {
        // Réinitialiser quand on n'est plus en mode modification
        setTicketsCount(0)
        setSelectedParticipants(isAdmin ? [] : [currentUserId])
      }
    }
  }, [isModifyMode, existingBooking, open, isAdmin, currentUserId])

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
      const maxParticipants = ticketsCount > 0 ? 4 - ticketsCount : 4
      if (selectedParticipants.length < maxParticipants) {
        // En mode admin, le premier sélectionné devient l'organisateur
        setSelectedParticipants([...selectedParticipants, userId])
      }
    }
  }

  const handleConfirm = () => {
    if (ticketsCount > 0) {
      // Mode tickets : calculer le nombre de participants requis
      const participantsNecessaires = 4 - ticketsCount
      if (selectedParticipants.length === participantsNecessaires) {
        onConfirm(selectedParticipants.length > 0 ? selectedParticipants : null, ticketsCount)
        setSelectedParticipants(isAdmin ? [] : [currentUserId])
        setSearchTerm('')
        setTicketsCount(0)
      }
    } else if (selectedParticipants.length === 4) {
      // Mode participants : 4 participants requis (pas de tickets)
      onConfirm(selectedParticipants, 0)
      setSelectedParticipants(isAdmin ? [] : [currentUserId])
      setSearchTerm('')
      setTicketsCount(0)
    }
  }

  // En mode modification, on peut utiliser les tickets déjà utilisés + les tickets disponibles
  const ticketsActuellementUtilises = isModifyMode ? (ticketsCount || 0) : 0
  const maxTicketsAvailable = isModifyMode 
    ? Math.min((currentUserTickets || 0) + ticketsActuellementUtilises, 3)
    : Math.min(currentUserTickets || 0, 3)
  const canUseTickets = maxTicketsAvailable > 0
  const participantsNecessaires = ticketsCount > 0 ? 4 - ticketsCount : 4

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
          {/* Option tickets (assez de tickets) */}
          {canUseTickets && (
            <div className="p-4 border rounded-lg bg-blue-50">
              <label className="text-sm font-medium mb-3 block">
                {isModifyMode ? 'Modifier le nombre de tickets' : 'Utiliser des tickets (optionnel)'} - Disponibles : {isModifyMode ? (currentUserTickets + ticketsActuellementUtilises) : currentUserTickets}
                {isModifyMode && ticketsActuellementUtilises > 0 && (
                  <span className="text-xs text-gray-500 ml-2">(dont {ticketsActuellementUtilises} déjà utilisés)</span>
                )}
              </label>
              <div className="flex gap-3 mb-2">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      if (ticketsCount === count) {
                        setTicketsCount(0)
                        if (!isAdmin) {
                          setSelectedParticipants([currentUserId])
                        } else {
                          setSelectedParticipants([])
                        }
                      } else if (currentUserTickets >= count) {
                        setTicketsCount(count)
                        // Ajuster les participants sélectionnés si nécessaire
                        const participantsNecessaires = 4 - count
                        if (selectedParticipants.length > participantsNecessaires) {
                          const newParticipants = selectedParticipants.slice(0, participantsNecessaires)
                          if (!isAdmin && !newParticipants.includes(currentUserId)) {
                            newParticipants[0] = currentUserId
                          }
                          setSelectedParticipants(newParticipants)
                        }
                      }
                    }}
                    disabled={currentUserTickets < count}
                    className={`px-4 py-2 rounded-md border transition-colors ${
                      ticketsCount === count
                        ? 'bg-blue-600 text-white border-blue-600'
                        : currentUserTickets >= count
                        ? 'bg-white border-gray-300 hover:bg-gray-50'
                        : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {count} ticket{count > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
              {ticketsCount > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                  Vous utiliserez {ticketsCount} ticket{ticketsCount > 1 ? 's' : ''} et devrez sélectionner {participantsNecessaires} participant{participantsNecessaires > 1 ? 's' : ''}.
                  Vous pourrez remplacer les tickets par des participants jusqu'à 30 minutes avant la réservation.
                </p>
              )}
            </div>
          )}

          {ticketsCount === 0 && (
            <>
          {/* Participants sélectionnés */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Participants sélectionnés ({selectedParticipants.length}/{participantsNecessaires})
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
                    const maxParticipants = ticketsCount > 0 ? 4 - ticketsCount : 4
                    const canSelect = selectedParticipants.length < maxParticipants || isSelected
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
                              {typeof user.activeBookingsCount === 'number' && (
                                <span className={`ml-2 text-xs font-normal ${
                                  user.activeBookingsCount >= 2 ? 'text-red-600 font-semibold' : 
                                  user.activeBookingsCount === 1 ? 'text-orange-600' : 
                                  'text-gray-500'
                                }`}>
                                  ({user.activeBookingsCount} réservation{user.activeBookingsCount > 1 ? 's' : ''} active{user.activeBookingsCount > 1 ? 's' : ''})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.email} • Matricule: {user.matricule}
                            </div>
                            {typeof user.activeBookingsCount === 'number' && user.activeBookingsCount >= 2 && (
                              <div className="text-xs text-red-600 mt-1 font-medium">
                                ⚠️ Quota atteint (2 max)
                              </div>
                            )}
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
            disabled={
              ticketsCount === 0 
                ? selectedParticipants.length !== 4
                : selectedParticipants.length !== participantsNecessaires
            }
          >
            {ticketsCount > 0
              ? `Confirmer avec ${ticketsCount} ticket${ticketsCount > 1 ? 's' : ''} et ${selectedParticipants.length}/${participantsNecessaires} participant${participantsNecessaires > 1 ? 's' : ''}`
              : `Confirmer la réservation (${selectedParticipants.length}/4)`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

