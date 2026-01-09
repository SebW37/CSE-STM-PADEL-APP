/**
 * API Route pour importer des utilisateurs depuis un fichier CSV/Excel
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { UserRole } from '@prisma/client'
import * as XLSX from 'xlsx'

interface ImportedUser {
  email: string
  matricule: string
  nom: string
  prenom: string
  soldeTickets?: number
  role?: string
  password?: string
}

function generatePassword(): string {
  // Génère un mot de passe aléatoire de 12 caractères
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function parseFile(buffer: Buffer, filename: string): ImportedUser[] {
  const users: ImportedUser[] = []
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    // Parser CSV
    const text = buffer.toString('utf-8')
    const lines = text.split('\n').filter(line => line.trim())
    
    // Ignorer la première ligne (en-têtes)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const emailIndex = headers.indexOf('email')
    const matriculeIndex = headers.indexOf('matricule')
    const nomIndex = headers.indexOf('nom')
    const prenomIndex = headers.indexOf('prenom')
    const ticketsIndex = headers.indexOf('soldetickets') !== -1 ? headers.indexOf('soldetickets') : headers.indexOf('tickets')
    const roleIndex = headers.indexOf('role')
    const passwordIndex = headers.indexOf('password')

    if (emailIndex === -1 || matriculeIndex === -1 || nomIndex === -1 || prenomIndex === -1) {
      throw new Error('Fichier CSV invalide: colonnes requises manquantes (email, matricule, nom, prenom)')
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values[emailIndex] && values[matriculeIndex] && values[nomIndex] && values[prenomIndex]) {
        users.push({
          email: values[emailIndex],
          matricule: values[matriculeIndex],
          nom: values[nomIndex],
          prenom: values[prenomIndex],
          soldeTickets: ticketsIndex !== -1 && values[ticketsIndex] ? parseInt(values[ticketsIndex]) || 10 : 10,
          role: roleIndex !== -1 && values[roleIndex] ? values[roleIndex].toUpperCase() : 'USER',
          password: passwordIndex !== -1 && values[passwordIndex] ? values[passwordIndex] : undefined
        })
      }
    }
  } else if (ext === 'xlsx' || ext === 'xls') {
    // Parser Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet) as any[]

    for (const row of data) {
      const email = row.email || row.Email || row.EMAIL
      const matricule = row.matricule || row.Matricule || row.MATRICULE
      const nom = row.nom || row.Nom || row.NOM
      const prenom = row.prenom || row.Prenom || row.PRENOM
      const tickets = row.soldeTickets || row.SoldeTickets || row.SOLDETICKETS || row.tickets || row.Tickets || row.TICKETS
      const role = row.role || row.Role || row.ROLE
      const password = row.password || row.Password || row.PASSWORD

      if (email && matricule && nom && prenom) {
        users.push({
          email: String(email),
          matricule: String(matricule),
          nom: String(nom),
          prenom: String(prenom),
          soldeTickets: tickets ? parseInt(String(tickets)) || 10 : 10,
          role: role ? String(role).toUpperCase() : 'USER',
          password: password ? String(password) : undefined
        })
      }
    }
  } else {
    throw new Error('Format de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)')
  }

  return users
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const importedUsers = parseFile(buffer, file.name)

    if (importedUsers.length === 0) {
      return NextResponse.json({ error: 'Aucun utilisateur trouvé dans le fichier' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const userData of importedUsers) {
      try {
        // Générer un mot de passe si non fourni
        const password = userData.password || generatePassword()

        // Créer dans Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: password,
          email_confirm: true
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            // Utilisateur existe déjà, on met à jour
            const { data: { users } } = await supabase.auth.admin.listUsers()
            const existingAuthUser = users?.find(u => u.email === userData.email)
            if (existingAuthUser && userData.password) {
              // Mettre à jour le mot de passe si fourni
              await supabase.auth.admin.updateUserById(existingAuthUser.id, {
                password: userData.password
              })
            }
          } else {
            throw authError
          }
        }

        // Créer/mettre à jour en base Prisma
        await prisma.user.upsert({
          where: { email: userData.email },
          update: {
            nom: userData.nom,
            prenom: userData.prenom,
            matricule: userData.matricule,
            soldeTickets: userData.soldeTickets || 10,
            role: (userData.role as UserRole) || UserRole.USER
          },
          create: {
            email: userData.email,
            nom: userData.nom,
            prenom: userData.prenom,
            matricule: userData.matricule,
            soldeTickets: userData.soldeTickets || 10,
            role: (userData.role as UserRole) || UserRole.USER
          }
        })

        successCount++
      } catch (error: any) {
        errorCount++
        errors.push(`${userData.email}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

