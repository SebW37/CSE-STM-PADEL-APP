/**
 * API Route pour remplacer les tickets par des participants dans une réservation
 * Doit être fait au moins 30 minutes avant la réservation
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { BookingStatus } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const body = await req.json()
    const { participantIds } = body

    // Récupérer la réservation
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        participants: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })
    }

    // Vérifier que c'est l'organisateur
    if (booking.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Accès refusé', message: 'Seul l\'organisateur peut modifier cette réservation.' },
        { status: 403 }
      )
    }

    // Vérifier que la réservation utilise des tickets
    if (!booking.utiliseTickets || booking.ticketsUtilises === 0) {
      return NextResponse.json(
        { error: 'Réservation invalide', message: 'Cette réservation n\'utilise pas de tickets.' },
        { status: 400 }
      )
    }

    // Vérifier la contrainte de 30 minutes
    const now = new Date()
    const bookingDate = new Date(booking.date)
    const timeDiff = bookingDate.getTime() - now.getTime()
    const minutesDiff = timeDiff / (1000 * 60)

    if (minutesDiff < 30) {
      return NextResponse.json(
        {
          error: 'Trop tard',
          message: 'Vous ne pouvez plus modifier cette réservation. La modification doit être faite au moins 30 minutes avant la réservation. Vos tickets sont perdus.'
        },
        { status: 403 }
      )
    }

    // Vérifier que 4 participants sont fournis
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length !== 4) {
      return NextResponse.json(
        { error: '4 participants requis', message: 'Vous devez fournir exactement 4 participants.' },
        { status: 400 }
      )
    }

    // Vérifier que l'organisateur est dans les participants
    if (!participantIds.includes(dbUser.id)) {
      return NextResponse.json(
        { error: 'Organisateur requis', message: 'L\'organisateur doit être parmi les 4 participants.' },
        { status: 400 }
      )
    }

    // Vérifier que tous les participants existent
    const participants = await prisma.user.findMany({
      where: {
        id: { in: participantIds }
      }
    })

    if (participants.length !== 4) {
      return NextResponse.json(
        { error: 'Participants invalides', message: 'Certains participants n\'existent pas.' },
        { status: 400 }
      )
    }

    // Vérifier qu'il n'y a pas de doublons
    if (new Set(participantIds).size !== 4) {
      return NextResponse.json(
        { error: 'Doublons détectés', message: 'Chaque participant ne peut être sélectionné qu\'une seule fois.' },
        { status: 400 }
      )
    }

    // Remplacer les tickets par les participants
    // 1. Restituer les tickets
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        soldeTickets: {
          increment: booking.ticketsUtilises
        }
      }
    })

    // 2. Mettre à jour la réservation
    await prisma.booking.update({
      where: { id: params.id },
      data: {
        ticketsUtilises: 0,
        utiliseTickets: false,
        participants: {
          deleteMany: {}, // Supprimer les anciens participants (s'il y en a)
          create: participantIds.map((participantId: string) => ({
            userId: participantId
          }))
        }
      }
    })

    // 3. Récupérer la réservation mise à jour
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        court: true,
        user: {
          select: {
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
      }
    })

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: 'Tickets remplacés par des participants avec succès. Les tickets ont été restitués.'
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


