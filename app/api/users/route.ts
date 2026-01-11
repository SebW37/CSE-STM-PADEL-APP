/**
 * API Route pour récupérer tous les utilisateurs (pour sélection dans les réservations)
 */
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { BookingStatus } from '@prisma/client'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer tous les utilisateurs avec leur nombre de réservations actives
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

    const now = new Date()
    
    // Pour chaque utilisateur, compter les réservations actives
    const usersWithActiveBookings = await Promise.all(
      users.map(async (user) => {
        // Compter les réservations où l'utilisateur est organisateur
        const asOrganizer = await prisma.booking.count({
          where: {
            userId: user.id,
            statut: BookingStatus.CONFIRME,
            date: {
              gte: now
            }
          }
        })

        // Compter les réservations où l'utilisateur est participant (mais pas organisateur)
        const asParticipant = await prisma.bookingParticipant.count({
          where: {
            userId: user.id,
            booking: {
              statut: BookingStatus.CONFIRME,
              date: {
                gte: now
              },
              userId: {
                not: user.id // Exclure celles où il est aussi organisateur
              }
            }
          }
        })

        const activeBookingsCount = asOrganizer + asParticipant

        return {
          ...user,
          activeBookingsCount
        }
      })
    )

    return NextResponse.json({ users: usersWithActiveBookings })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


