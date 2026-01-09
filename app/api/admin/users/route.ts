/**
 * API Route pour la gestion des utilisateurs (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { UserRole } from '@prisma/client'

/**
 * POST : Créer un utilisateur
 */
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

    const body = await req.json()
    const { email, password, matricule, nom, prenom, soldeTickets, role } = body

    if (!email || !password || !matricule || !nom || !prenom) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      )
    }

    // Créer dans Supabase Auth
    const supabase = createSupabaseAdminClient()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json(
        { error: 'Erreur Supabase', message: authError.message },
        { status: 400 }
      )
    }

    // Créer en base Prisma
    const dbUser = await prisma.user.create({
      data: {
        email,
        matricule,
        nom,
        prenom,
        soldeTickets: soldeTickets || 10,
        role: (role as UserRole) || UserRole.USER
      }
    })

    return NextResponse.json({ user: dbUser }, { status: 201 })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

