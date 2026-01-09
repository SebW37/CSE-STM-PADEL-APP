'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Users, Plus, Edit, CreditCard, Shield, X, Lock, Unlock, Download, Upload, RotateCcw } from 'lucide-react'

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  soldeTickets?: number
  role: string
  bloque?: boolean
}

export function UsersManagementPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    matricule: '',
    nom: '',
    prenom: '',
    soldeTickets: 10,
    role: 'USER',
    bloque: false
  })
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

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

  const handleCreateUser = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      password: '',
      matricule: '',
      nom: '',
      prenom: '',
      soldeTickets: 10,
      role: 'USER'
    })
    setDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '',
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      soldeTickets: user.soldeTickets ?? 0,
      role: user.role,
      bloque: user.bloque || false
    })
    setDialogOpen(true)
  }

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloque: !currentBlocked })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert(currentBlocked ? 'Utilisateur débloqué' : 'Utilisateur bloqué')
      loadUsers()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleResetAll = async () => {
    if (!confirm('Êtes-vous sûr de vouloir bloquer TOUS les utilisateurs (sauf admins) ? Cette action est irréversible sans déblocage manuel.')) {
      return
    }

    try {
      const response = await fetch('/api/admin/users/reset', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      const data = await response.json()
      alert(`${data.blockedCount} utilisateur(s) bloqué(s)`)
      loadUsers()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      const response = await fetch(`/api/admin/users/template?format=${format}`)
      if (!response.ok) throw new Error('Erreur lors du téléchargement')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template_import_utilisateurs.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      alert('Veuillez sélectionner un fichier')
      return
    }

    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      const data = await response.json()
      alert(`Import réussi: ${data.imported} utilisateur(s) importé(s)${data.errors > 0 ? `, ${data.errors} erreur(s)` : ''}`)
      setImportDialogOpen(false)
      setImportFile(null)
      loadUsers()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  const handleSaveUser = async () => {
    try {
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'
      
      const method = editingUser ? 'PATCH' : 'POST'
      
      const body: any = {
        email: formData.email,
        matricule: formData.matricule,
        nom: formData.nom,
        prenom: formData.prenom,
        soldeTickets: formData.soldeTickets,
        role: formData.role,
        bloque: formData.bloque
      }

      if (!editingUser && formData.password) {
        body.password = formData.password
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert(editingUser ? 'Utilisateur mis à jour' : 'Utilisateur créé')
      setDialogOpen(false)
      loadUsers()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleUpdateTickets = async (userId: string, tickets: number) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur')
      }

      alert('Tickets mis à jour')
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Gestion des Utilisateurs</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownloadTemplate('xlsx')}>
                <Download className="w-4 h-4 mr-2" />
                Template Excel
              </Button>
              <Button variant="outline" onClick={() => handleDownloadTemplate('csv')}>
                <Download className="w-4 h-4 mr-2" />
                Template CSV
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Importer
              </Button>
              <Button variant="destructive" onClick={handleResetAll}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Bloquer tous (année)
              </Button>
              <Button onClick={handleCreateUser}>
                <Plus className="w-4 h-4 mr-2" />
                Créer
              </Button>
            </div>
          </div>
          <CardDescription>
            Créer, modifier et gérer les utilisateurs et leurs crédits. Bloquer/débloquer selon les cotisations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        {user.prenom} {user.nom}
                      </h3>
                      {user.bloque && (
                        <Badge variant="destructive">
                          <Lock className="w-3 h-3 mr-1" />
                          Bloqué
                        </Badge>
                      )}
                      {user.role === 'SUPER_ADMIN' && (
                        <Badge variant="default">
                          <Shield className="w-3 h-3 mr-1" />
                          Super Admin
                        </Badge>
                      )}
                      {user.role === 'ADMIN' && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Email: {user.email}</div>
                      <div>Matricule: {user.matricule}</div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span>Tickets: {user.soldeTickets ?? 0}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const tickets = prompt('Nouveau solde de tickets:', (user.soldeTickets ?? 0).toString())
                            if (tickets) {
                              handleUpdateTickets(user.id, parseInt(tickets))
                            }
                          }}
                        >
                          Modifier
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.role === 'USER' && (
                      <Button
                        variant={user.bloque ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleBlock(user.id, user.bloque || false)}
                      >
                        {user.bloque ? (
                          <>
                            <Unlock className="w-4 h-4 mr-1" />
                            Débloquer
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-1" />
                            Bloquer
                          </>
                        )}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleEditUser(user)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${user.prenom} ${user.nom} ?`)) {
                          return
                        }
                        try {
                          const response = await fetch(`/api/admin/users/${user.id}`, {
                            method: 'DELETE'
                          })
                          if (!response.ok) throw new Error('Erreur lors de la suppression')
                          alert('Utilisateur supprimé')
                          loadUsers()
                        } catch (error: any) {
                          alert('Erreur: ' + error.message)
                        }
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de création/édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? 'Modifiez les informations de l\'utilisateur' : 'Remplissez les informations pour créer un nouvel utilisateur'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
            {!editingUser && (
              <div>
                <label className="text-sm font-medium">Mot de passe</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Matricule</label>
              <input
                type="text"
                value={formData.matricule}
                onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prénom</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nom</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Tickets</label>
              <input
                type="number"
                value={formData.soldeTickets}
                onChange={(e) => setFormData({ ...formData, soldeTickets: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rôle</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
                <option value="SUPER_ADMIN">Super Administrateur</option>
              </select>
            </div>
            {editingUser && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bloque"
                  checked={formData.bloque}
                  onChange={(e) => setFormData({ ...formData, bloque: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="bloque" className="text-sm font-medium">
                  Utilisateur bloqué
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'import */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importer des utilisateurs</DialogTitle>
            <DialogDescription>
              Téléchargez d'abord le template, remplissez-le avec vos données, puis importez-le ici.
              Format supporté: CSV ou Excel (.xlsx, .xls)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fichier à importer</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Colonnes requises: email, matricule, nom, prenom
                <br />
                Colonnes optionnelles: soldeTickets (défaut: 10), role (défaut: USER), password (généré si absent)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false)
              setImportFile(null)
            }}>
              Annuler
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing ? 'Import en cours...' : 'Importer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

