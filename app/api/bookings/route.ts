/**
 * API Route pour les réservations
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import {
  canUserCreateBooking,
  isBookingDateValid,
  isCourtAvailable
} from '@/lib/prisma/rules'
import { BookingStatus } from '@prisma/client'

/**
 * GET : Récupérer les réservations
 * Query params : startDate, endDate (optionnels)
 */
export async function GET(req: NextRequest) {
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

    // Récupérer les paramètres de date (optionnels)
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {
      statut: BookingStatus.CONFIRME
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else {
      // Par défaut, récupérer les réservations futures
      where.date = {
        gte: new Date()
      }
    }

    // Récupérer toutes les réservations (pas seulement celles de l'utilisateur)
    // pour afficher le planning complet
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
        date: 'asc'
      }
    })

    // Nettoyer les données pour s'assurer qu'il n'y a pas de valeurs null
    const cleanedBookings = bookings.map(booking => ({
      ...booking,
      participants: (booking.participants || []).filter(p => p && p.user !== null && p.user !== undefined)
    }))

    return NextResponse.json({ bookings: cleanedBookings, currentUserId: dbUser.id })
  } catch (error: any) {
    console.error('Erreur lors de la récupération des réservations:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST : Créer une réservation
 */
export async function POST(req: NextRequest) {
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
        { error: 'Utilisateur non trouvé en base de données' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { courtId, date, duree = 60, participantIds, useTickets } = body

    if (!courtId || !date) {
      return NextResponse.json(
        { error: 'courtId et date sont requis' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur n'est pas bloqué
    if (dbUser.bloque === true) {
      return NextResponse.json(
        {
          error: 'Utilisateur bloqué',
          message: 'Votre compte est actuellement bloqué. Veuillez contacter l\'administrateur pour plus d\'informations.'
        },
        { status: 403 }
      )
    }

    const bookingDate = new Date(date)
    const useTicketsMode = useTickets === true

    // Validation : soit useTickets=true, soit participantIds avec 4 participants
    if (!useTicketsMode && (!participantIds || !Array.isArray(participantIds) || participantIds.length !== 4)) {
      return NextResponse.json(
        { 
          error: 'Mode de réservation invalide', 
          message: 'Vous devez soit utiliser 3 tickets (useTickets=true), soit fournir exactement 4 participants.' 
        },
        { status: 400 }
      )
    }

    // Mode 1: Réservation avec tickets (3 tickets)
    if (useTicketsMode) {
      const ticketsNecessaires = 3
      
      // Vérifier que l'utilisateur a assez de tickets
      if (dbUser.soldeTickets < ticketsNecessaires) {
        return NextResponse.json(
          {
            error: 'Tickets insuffisants',
            message: `Vous n'avez pas assez de tickets. Solde actuel : ${dbUser.soldeTickets}, requis : ${ticketsNecessaires}`
          },
          { status: 403 }
        )
      }

      // Vérifier les règles métier
      if (!isBookingDateValid(bookingDate)) {
        return NextResponse.json(
          {
            error: 'Date invalide',
            message: 'Les réservations sont possibles pour toute date future.'
          },
          { status: 400 }
        )
      }

      const canCreateResult = await canUserCreateBooking(dbUser.id)
      if (!canCreateResult.canCreate) {
        let message = `Vous avez déjà ${canCreateResult.activeCount || 0} réservation(s) active(s). Maximum 2 réservations simultanées.`
        
        if (canCreateResult.blockingUsers && canCreateResult.blockingUsers.length > 0) {
          const uniqueUsers = Array.from(new Set(canCreateResult.blockingUsers.map(u => u.name)))
          message += `\n\nVous avez des réservations avec : ${uniqueUsers.join(', ')}`
        }
        
        return NextResponse.json(
          {
            error: canCreateResult.reason || 'Quota de réservations atteint',
            message
          },
          { status: 403 }
        )
      }

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

      const court = await prisma.court.findUnique({
        where: { id: courtId }
      })

      if (!court || !court.actif) {
        return NextResponse.json(
          { error: 'Terrain non disponible', message: 'Ce terrain est actuellement inactif.' },
          { status: 403 }
        )
      }

      // Créer la réservation avec tickets (sans participants)
      const booking = await prisma.booking.create({
        data: {
          userId: dbUser.id,
          courtId: courtId,
          date: bookingDate,
          duree: duree,
          statut: BookingStatus.CONFIRME,
          ticketsUtilises: ticketsNecessaires,
          utiliseTickets: true
        },
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

      // Déduire les tickets
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          soldeTickets: {
            decrement: ticketsNecessaires
          }
        }
      })

      return NextResponse.json(
        {
          success: true,
          booking: booking,
          message: 'Réservation créée avec 3 tickets. Vous pouvez remplacer les tickets par des participants jusqu\'à 30 minutes avant la réservation.'
        },
        { status: 201 }
      )
    }

    // Mode 2: Réservation avec 4 participants (useTickets=false ou non défini)
    // Note: Cette vérification est déjà faite plus haut, mais on la garde pour sécurité

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

    // Vérifier les règles métier pour réservation avec participants
    if (!isBookingDateValid(bookingDate)) {
      return NextResponse.json(
        {
          error: 'Date invalide',
          message: 'Les réservations sont possibles pour toute date future.'
        },
        { status: 400 }
      )
    }

      const canCreateResult = await canUserCreateBooking(dbUser.id)
      if (!canCreateResult.canCreate) {
        let message = `Vous avez déjà ${canCreateResult.activeCount || 0} réservation(s) active(s). Maximum 2 réservations simultanées.`
        
        if (canCreateResult.blockingUsers && canCreateResult.blockingUsers.length > 0) {
          const uniqueUsers = Array.from(new Set(canCreateResult.blockingUsers.map(u => u.name)))
          message += `\n\nVous avez des réservations avec : ${uniqueUsers.join(', ')}`
        }
        
        return NextResponse.json(
          {
            error: canCreateResult.reason || 'Quota de réservations atteint',
            message
          },
          { status: 403 }
        )
      }

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

    const court = await prisma.court.findUnique({
      where: { id: courtId }
    })

    if (!court || !court.actif) {
      return NextResponse.json(
        { error: 'Terrain non disponible', message: 'Ce terrain est actuellement inactif.' },
        { status: 403 }
      )
    }

    // Créer la réservation avec les 4 participants (pas de tickets)
    const booking = await prisma.booking.create({
      data: {
        userId: dbUser.id,
        courtId: courtId,
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

    return NextResponse.json(
      {
        success: true,
        booking: booking
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Erreur lors de la création de la réservation:', error)
    console.error('Détails de l\'erreur:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })
    
    // Message d'erreur plus détaillé
    let errorMessage = error.message || 'Erreur serveur inconnue'
    
    // Si c'est une erreur Prisma, donner plus de détails
    if (error.code) {
      switch (error.code) {
        case 'P2002':
          errorMessage = 'Une réservation existe déjà avec ces paramètres'
          break
        case 'P2003':
          errorMessage = 'Référence invalide (terrain ou utilisateur introuvable)'
          break
        case 'P2025':
          errorMessage = 'Enregistrement non trouvé'
          break
        default:
          errorMessage = `Erreur Prisma (${error.code}): ${error.message}`
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Erreur serveur', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          meta: error.meta,
          stack: error.stack?.split('\n').slice(0, 5)
        } : undefined
      },
      { status: 500 }
    )
  }
}


