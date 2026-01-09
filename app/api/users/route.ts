/**
 * API Route pour récupérer tous les utilisateurs (pour sélection dans les réservations)
 */
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        email: true
      },
      orderBy: [
        { nom: 'asc' },
        { prenom: 'asc' }
      ]
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

