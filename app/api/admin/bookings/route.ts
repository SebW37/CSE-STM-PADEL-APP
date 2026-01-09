/**
 * API Route pour la gestion des réservations (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { BookingStatus } from '@prisma/client'
import { canUserCreateBooking, isBookingDateValid, isCourtAvailable } from '@/lib/prisma/rules'

/**
 * GET : Récupérer toutes les réservations
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
    const status = searchParams.get('status')

    const where: any = {}
    if (status && status !== 'all') {
      where.statut = status as BookingStatus
    }

    const bookings = await prisma.booking.findMany({
      where,
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
      },
      take: 100
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

/**
 * POST : Créer une réservation (Admin)
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
    const { userId, courtId, date, duree = 60, participantIds } = body

    if (!userId || !courtId || !date) {
      return NextResponse.json(
        { error: 'userId, courtId et date sont requis' },
        { status: 400 }
      )
    }

    // Vérifier que 4 participants sont fournis
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length !== 4) {
      return NextResponse.json(
        { error: '4 participants requis' },
        { status: 400 }
      )
    }

    const bookingDate = new Date(date)

    // Vérifier les règles métier (même pour les admins, on peut choisir de les respecter ou non)
    // Ici, on vérifie mais on permet aux admins de contourner avec un paramètre
    const skipValidation = body.skipValidation === true

    // Vérifier que le terrain existe et est actif (même en mode skipValidation)
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: { actif: true, numero: true, nom: true }
    })

    if (!court) {
      return NextResponse.json(
        { error: 'Terrain non trouvé' },
        { status: 404 }
      )
    }

    if (!court.actif) {
      return NextResponse.json(
        {
          error: 'Terrain en maintenance',
          message: `Le terrain ${court.numero} (${court.nom}) est actuellement en maintenance et ne peut pas être réservé.`
        },
        { status: 403 }
      )
    }

    if (!skipValidation) {
      // 1. Vérifier que la date est valide (7 jours à l'avance max)
      if (!isBookingDateValid(bookingDate)) {
        return NextResponse.json(
          {
            error: 'Date invalide',
            message: 'Les réservations sont possibles jusqu\'à 7 jours à l\'avance maximum.'
          },
          { status: 400 }
        )
      }

      // 2. Vérifier le quota de réservations simultanées (2 réservations actives max)
      const canCreateResult = await canUserCreateBooking(userId)
      const canCreate = canCreateResult.canCreate
      if (!canCreate) {
        return NextResponse.json(
          {
            error: 'Quota de réservations atteint',
            message: 'L\'utilisateur a déjà 2 réservations actives. Maximum 2 réservations simultanées. Utilisez skipValidation=true pour contourner cette règle.'
          },
          { status: 403 }
        )
      }

      // 3. Vérifier que le terrain est disponible
      const isAvailable = await isCourtAvailable(courtId, bookingDate, duree)
      if (!isAvailable) {
        return NextResponse.json(
          {
            error: 'Terrain non disponible',
            message: 'Ce terrain est déjà réservé à cette date/heure.'
          },
          { status: 409 }
        )
      }
    }

    // Créer la réservation
    const booking = await prisma.booking.create({
      data: {
        userId,
        courtId,
        date: bookingDate,
        duree: duree,
        statut: BookingStatus.CONFIRME,
        ticketsUtilises: 0,
        utiliseTickets: false,
        participants: {
          create: participantIds.map((participantId: string) => ({
            userId: participantId
          }))
        }
      },
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

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

