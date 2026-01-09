/**
 * API Route pour la gestion des terrains (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'

/**
 * GET : Récupérer tous les terrains avec leurs statuts
 */
export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est admin
    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Administrateur requis.' },
        { status: 403 }
      )
    }

    const courts = await prisma.court.findMany({
      orderBy: { numero: 'asc' },
      include: {
        _count: {
          select: {
            bookings: {
              where: {
                statut: 'CONFIRME',
                date: {
                  gte: new Date()
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ courts })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH : Mettre à jour le statut d'un terrain (maintenance)
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est admin
    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Administrateur requis.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { courtId, actif } = body

    if (!courtId || typeof actif !== 'boolean') {
      return NextResponse.json(
        { error: 'courtId et actif (boolean) sont requis' },
        { status: 400 }
      )
    }

    const court = await prisma.court.update({
      where: { id: courtId },
      data: { actif }
    })

    return NextResponse.json({
      success: true,
      court,
      message: actif ? 'Terrain activé' : 'Terrain désactivé (maintenance)'
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


