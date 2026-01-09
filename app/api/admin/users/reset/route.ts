/**
 * API Route pour bloquer tous les utilisateurs (sauf admins)
 * Bloque tous les utilisateurs avec role USER pour la réinitialisation annuelle
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { UserRole } from '@prisma/client'

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

    // Bloquer tous les utilisateurs non-admin
    const result = await prisma.user.updateMany({
      where: {
        role: {
          not: UserRole.ADMIN
        }
      },
      data: {
        bloque: true
      }
    })

    return NextResponse.json({
      success: true,
      blockedCount: result.count,
      message: `${result.count} utilisateur(s) bloqué(s)`
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

