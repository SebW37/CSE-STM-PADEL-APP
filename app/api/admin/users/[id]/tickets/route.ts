/**
 * API Route pour gérer les tickets d'un utilisateur (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'

/**
 * PATCH : Mettre à jour les tickets d'un utilisateur
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { tickets } = body

    if (typeof tickets !== 'number' || tickets < 0) {
      return NextResponse.json(
        { error: 'Nombre de tickets invalide' },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.update({
      where: { id: params.id },
      data: { soldeTickets: tickets }
    })

    return NextResponse.json({ user: dbUser })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


