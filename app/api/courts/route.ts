/**
 * API Route pour récupérer les terrains
 */
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET() {
  try {
    // Vérifier l'authentification
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer les 3 terrains
    const courts = await prisma.court.findMany({
      orderBy: {
        numero: 'asc'
      }
    })

    return NextResponse.json({ courts })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des terrains:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


