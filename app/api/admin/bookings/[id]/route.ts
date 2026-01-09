/**
 * API Route pour modifier/supprimer une réservation (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { BookingStatus } from '@prisma/client'

/**
 * PATCH : Modifier une réservation
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { courtId, date, duree, statut, participantIds } = body

    const updateData: any = {}
    if (courtId) updateData.courtId = courtId
    if (date) updateData.date = new Date(date)
    if (duree) updateData.duree = duree
    if (statut) updateData.statut = statut as BookingStatus

    // Si les participants sont modifiés
    if (participantIds && Array.isArray(participantIds) && participantIds.length === 4) {
      // Supprimer les anciens participants
      await prisma.bookingParticipant.deleteMany({
        where: { bookingId: params.id }
      })

      // Créer les nouveaux participants
      updateData.participants = {
        create: participantIds.map((participantId: string) => ({
          userId: participantId
        }))
      }
    }

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: updateData,
      include: {
        court: true,
        user: true,
        participants: {
          include: {
            user: true
          }
        }
      }
    })

    return NextResponse.json({ booking })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE : Supprimer/Annuler une réservation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Annuler la réservation (ou la supprimer complètement)
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { user: true }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })
    }

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

    // Supprimer la réservation (cascade supprimera les participants)
    await prisma.booking.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

