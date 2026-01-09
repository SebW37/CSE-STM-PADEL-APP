/**
 * API Route pour permettre aux participants d'annuler leur participation à une réservation
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { BookingStatus } from '@prisma/client'

/**
 * POST : Annuler la participation d'un utilisateur à une réservation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Récupérer la réservation avec ses participants
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
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
        },
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Réservation non trouvée' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur est soit l'organisateur, soit un participant
    const isOrganizer = booking.userId === dbUser.id
    const isParticipant = booking.participants.some(p => p.userId === dbUser.id)

    if (!isOrganizer && !isParticipant) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas autorisé à annuler cette réservation' },
        { status: 403 }
      )
    }

    // Si c'est l'organisateur, annuler toute la réservation
    if (isOrganizer) {
      // Restituer les tickets si la réservation utilisait des tickets
      if (booking.utiliseTickets && booking.ticketsUtilises > 0) {
        await prisma.user.update({
          where: { id: booking.userId },
          data: {
            soldeTickets: {
              increment: booking.ticketsUtilises
            }
          }
        })
      }

      // Annuler la réservation (les participants seront supprimés en cascade)
      await prisma.booking.update({
        where: { id: params.id },
        data: {
          statut: BookingStatus.ANNULE
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Réservation annulée avec succès',
        cancelled: true // Indique que toute la réservation a été annulée
      })
    }

    // Si c'est un participant, le retirer
    // Si cela fait passer sous 4 participants, annuler toute la réservation
    if (isParticipant) {
      // Vérifier le nombre actuel de participants
      const currentParticipantCount = booking.participants.length
      
      // Si on est exactement à 4 participants et qu'on en retire un, on passe à 3
      // Donc on doit annuler toute la réservation
      if (currentParticipantCount === 4) {
        // Retirer le participant
        await prisma.bookingParticipant.deleteMany({
          where: {
            bookingId: params.id,
            userId: dbUser.id
          }
        })

        // Restituer les tickets à l'organisateur si la réservation utilisait des tickets
        if (booking.utiliseTickets && booking.ticketsUtilises > 0) {
          await prisma.user.update({
            where: { id: booking.userId },
            data: {
              soldeTickets: {
                increment: booking.ticketsUtilises
              }
            }
          })
        }

        // Annuler la réservation car il ne reste plus assez de participants
        await prisma.booking.update({
          where: { id: params.id },
          data: {
            statut: BookingStatus.ANNULE
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Votre participation a été annulée. La réservation a été annulée car il ne reste plus assez de participants (minimum 4 requis).',
          cancelled: true
        })
      }

      // Si moins de 4 participants, la réservation devrait déjà être annulée
      // Mais on retire quand même le participant
      await prisma.bookingParticipant.deleteMany({
        where: {
          bookingId: params.id,
          userId: dbUser.id
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Votre participation a été annulée avec succès',
        cancelled: false
      })
    }

    return NextResponse.json(
      { error: 'Action non autorisée' },
      { status: 403 }
    )
  } catch (error: any) {
    console.error('Erreur lors de l\'annulation:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

