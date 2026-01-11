/**
 * API Route pour bloquer/débloquer un utilisateur individuellement
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'

export async function POST(
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
    const { bloque } = body

    if (typeof bloque !== 'boolean') {
      return NextResponse.json(
        { error: 'Le paramètre bloque doit être un booléen' },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Ne pas permettre de bloquer les admins
    if (dbUser.role !== 'USER' && bloque) {
      return NextResponse.json(
        { error: 'Impossible de bloquer un administrateur' },
        { status: 403 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { bloque }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: bloque ? 'Utilisateur bloqué' : 'Utilisateur débloqué'
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


