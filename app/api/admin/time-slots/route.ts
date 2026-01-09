/**
 * API Route pour la gestion des plages horaires (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'

/**
 * GET : Récupérer les plages horaires bloquées
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const courtId = searchParams.get('courtId')

    const where: any = { actif: true }
    if (date) {
      const dateObj = new Date(date)
      const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0))
      const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999))
      where.date = { gte: startOfDay, lte: endOfDay }
    }
    if (courtId) {
      where.courtId = courtId
    }

    const blocks = await prisma.timeSlotBlock.findMany({
      where,
      include: {
        court: true
      },
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json({ blocks })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST : Créer un blocage de plage horaire
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
    const { courtId, date, startTime, endTime, raison } = body

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'date, startTime et endTime sont requis' },
        { status: 400 }
      )
    }

    const block = await prisma.timeSlotBlock.create({
      data: {
        courtId: courtId || null, // null = tous les terrains
        date: new Date(date),
        startTime,
        endTime,
        raison: raison || null,
        actif: true
      },
      include: {
        court: true
      }
    })

    return NextResponse.json({ block }, { status: 201 })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

