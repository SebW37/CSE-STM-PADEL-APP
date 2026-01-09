/**
 * API Route pour récupérer les plages horaires bloquées (pour le planning)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const courtId = searchParams.get('courtId')

    const where: any = { actif: true }
    
    // Gérer les paramètres de date
    if (startDateParam && endDateParam) {
      // Utiliser startDate et endDate pour une plage
      where.date = {
        gte: new Date(startDateParam),
        lte: new Date(endDateParam)
      }
    } else if (dateParam) {
      // Utiliser date pour une seule journée
      const dateObj = new Date(dateParam)
      const startOfDay = new Date(dateObj)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateObj)
      endOfDay.setHours(23, 59, 59, 999)
      where.date = { 
        gte: startOfDay, 
        lte: endOfDay 
      }
    }
    
    // Gérer le filtrage par terrain
    if (courtId) {
      where.OR = [
        { courtId: courtId },
        { courtId: null } // Blocages globaux
      ]
    }

    const blocks = await prisma.timeSlotBlock.findMany({
      where,
      select: {
        id: true,
        courtId: true,
        date: true,
        startTime: true,
        endTime: true,
        raison: true,
        court: {
          select: {
            id: true,
            numero: true,
            nom: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // Convertir les dates en ISO string pour le client
    const formattedBlocks = blocks.map(block => ({
      ...block,
      date: block.date.toISOString()
    }))

    return NextResponse.json({ blocks: formattedBlocks })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des plages bloquées:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

