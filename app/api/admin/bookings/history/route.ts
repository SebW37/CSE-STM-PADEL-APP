/**
 * API Route pour l'historique des réservations (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

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
    const filter = searchParams.get('filter') || 'all'

    const now = new Date()
    let dateFilter: any = {}

    switch (filter) {
      case 'today':
        dateFilter = {
          gte: startOfDay(now),
          lte: endOfDay(now)
        }
        break
      case 'week':
        dateFilter = {
          gte: startOfWeek(now, { weekStartsOn: 1 }),
          lte: endOfWeek(now, { weekStartsOn: 1 })
        }
        break
      case 'month':
        dateFilter = {
          gte: startOfMonth(now),
          lte: endOfMonth(now)
        }
        break
      case 'year':
        dateFilter = {
          gte: startOfYear(now),
          lte: endOfYear(now)
        }
        break
    }

    const bookings = await prisma.booking.findMany({
      where: filter !== 'all' ? { date: dateFilter } : {},
      include: {
        court: true,
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    return NextResponse.json({ bookings })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

