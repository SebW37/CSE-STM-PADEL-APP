/**
 * API Route pour modifier une réservation avec tickets
 * Permet d'ajuster le nombre de tickets et participants
 * Doit être fait au moins 30 minutes avant la réservation
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { canUserCreateBooking } from '@/lib/prisma/rules'

export async function PATCH(
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
    const { ticketsCount = 0, participantIds = [] } = body

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

    const ticketsToUse = ticketsCount && ticketsCount > 0 ? parseInt(ticketsCount) : 0
    const participantsNecessaires = 4 - ticketsToUse

    // Note: On ne vérifie PAS le quota de l'organisateur lors de la modification car il modifie sa propre réservation.
    // On vérifie seulement le quota des autres participants (en excluant la réservation actuelle).

    // Validation
    if (ticketsToUse === 0 && (!participantIds || !Array.isArray(participantIds) || participantIds.length !== 4)) {
      return NextResponse.json(
        { 
          error: 'Mode de réservation invalide', 
          message: 'Vous devez soit utiliser 1, 2 ou 3 tickets, soit fournir exactement 4 participants.' 
        },
        { status: 400 }
      )
    }

    if (ticketsToUse > 0 && ticketsToUse <= 3) {
      const participantsCount = participantIds && Array.isArray(participantIds) ? participantIds.length : 0
      if (participantsCount !== participantsNecessaires) {
        return NextResponse.json(
          { 
            error: 'Nombre de participants invalide', 
            message: `Avec ${ticketsToUse} ticket(s), vous devez fournir exactement ${participantsNecessaires} participant(s).` 
          },
          { status: 400 }
        )
      }

      // Vérifier que l'utilisateur a assez de tickets (en tenant compte des tickets déjà utilisés)
      const ticketsActuellementUtilises = booking.ticketsUtilises
      const ticketsSupplementaires = ticketsToUse - ticketsActuellementUtilises
      const soldeApresRestitution = dbUser.soldeTickets + ticketsActuellementUtilises

      if (soldeApresRestitution < ticketsToUse) {
        return NextResponse.json(
          {
            error: 'Tickets insuffisants',
            message: `Vous n'avez pas assez de tickets. Après restitution des ${ticketsActuellementUtilises} ticket(s) actuels, vous aurez ${soldeApresRestitution} ticket(s), mais ${ticketsToUse} sont requis.`
          },
          { status: 403 }
        )
      }

      // 1. Restituer les tickets actuels
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          soldeTickets: {
            increment: ticketsActuellementUtilises
          }
        }
      })

      // 2. Déduire les nouveaux tickets
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          soldeTickets: {
            decrement: ticketsToUse
          }
        }
      })

      // 3. Vérifier le quota des participants (en excluant la réservation actuelle et l'organisateur)
      if (participantIds && participantIds.length > 0) {
        const participantsWithQuotaIssues: Array<{ id: string; name: string; activeCount: number }> = []
        
        // Exclure l'organisateur de la vérification (il est déjà organisateur de cette réservation)
        // L'organisateur peut toujours modifier sa propre réservation même s'il a 2 réservations actives
        const participantsToCheck = participantIds.filter(id => {
          const isOrganizer = id === dbUser.id
          if (isOrganizer) {
            console.log(`[UPDATE] ⚠️ Exclusion de l'organisateur ${id} (${dbUser.email}) de la vérification du quota`)
          }
          return !isOrganizer
        })
        
        console.log(`[UPDATE] Vérification quota - Organisateur: ${dbUser.id} (${dbUser.email})`)
        console.log(`[UPDATE] Liste complète participantIds:`, participantIds)
        console.log(`[UPDATE] Liste filtrée participantsToCheck (${participantsToCheck.length}):`, participantsToCheck)
        
        // Vérifier que l'organisateur n'est PAS dans la liste à vérifier
        if (participantsToCheck.includes(dbUser.id)) {
          console.error(`[UPDATE] ❌ ERREUR: L'organisateur est toujours dans la liste à vérifier !`)
        }
        
        for (const participantId of participantsToCheck) {
          // Double vérification : ne jamais vérifier l'organisateur
          if (participantId === dbUser.id) {
            console.error(`[UPDATE] ❌ ERREUR: Tentative de vérifier l'organisateur ${participantId}, ignoré`)
            continue
          }
          
          const canCreateResult = await canUserCreateBooking(participantId, params.id)
          console.log(`[UPDATE] Participant ${participantId}: canCreate=${canCreateResult.canCreate}, activeCount=${canCreateResult.activeCount}`)
          
          if (!canCreateResult.canCreate && canCreateResult.activeCount && canCreateResult.activeCount >= 2) {
            const participant = await prisma.user.findUnique({
              where: { id: participantId },
              select: { nom: true, prenom: true }
            })
            if (participant) {
              participantsWithQuotaIssues.push({
                id: participantId,
                name: `${participant.prenom} ${participant.nom}`,
                activeCount: canCreateResult.activeCount
              })
            }
          }
        }
        
        if (participantsWithQuotaIssues.length > 0) {
          const names = participantsWithQuotaIssues.map(p => `• ${p.name} : ${p.activeCount} réservation(s) active(s)`)
          return NextResponse.json(
            {
              error: 'Quota de réservations atteint pour certains participants',
              message: `Les participants suivants ont déjà atteint leur quota de 2 réservations actives :\n\n${names.join('\n')}\n\nVeuillez choisir d'autres participants.`
            },
            { status: 403 }
          )
        }
      }

      // 4. Mettre à jour la réservation
      await prisma.booking.update({
        where: { id: params.id },
        data: {
          ticketsUtilises: ticketsToUse,
          utiliseTickets: ticketsToUse > 0,
          participants: {
            deleteMany: {}, // Supprimer les anciens participants
            create: participantIds && participantIds.length > 0 ? participantIds.map((participantId: string) => ({
              userId: participantId
            })) : []
          }
        }
      })
    } else if (ticketsToUse === 0) {
      // Remplacer tous les tickets par 4 participants
      // 1. Restituer les tickets
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          soldeTickets: {
            increment: booking.ticketsUtilises
          }
        }
      })

      // 2. Vérifier que l'organisateur est dans les participants
      if (!participantIds.includes(dbUser.id)) {
        return NextResponse.json(
          { error: 'Organisateur requis', message: 'L\'organisateur doit être parmi les 4 participants.' },
          { status: 400 }
        )
      }

      // 3. Vérifier que tous les participants existent
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

      // 4. Vérifier qu'il n'y a pas de doublons
      if (new Set(participantIds).size !== 4) {
        return NextResponse.json(
          { error: 'Doublons détectés', message: 'Chaque participant ne peut être sélectionné qu\'une seule fois.' },
          { status: 400 }
        )
      }

      // 5. Vérifier le quota des participants (en excluant la réservation actuelle et l'organisateur)
      const participantsWithQuotaIssues: Array<{ id: string; name: string; activeCount: number }> = []
      
      // Exclure l'organisateur de la vérification (il est déjà organisateur de cette réservation)
      // L'organisateur peut toujours modifier sa propre réservation même s'il a 2 réservations actives
      const participantsToCheck = participantIds.filter(id => {
        const isOrganizer = id === dbUser.id
        if (isOrganizer) {
          console.log(`[UPDATE] ⚠️ Exclusion de l'organisateur ${id} (${dbUser.email}) de la vérification du quota (mode 4 participants)`)
        }
        return !isOrganizer
      })
      
      console.log(`[UPDATE] Mode 4 participants - Organisateur: ${dbUser.id} (${dbUser.email})`)
      console.log(`[UPDATE] Liste complète participantIds:`, participantIds)
      console.log(`[UPDATE] Liste filtrée participantsToCheck (${participantsToCheck.length}):`, participantsToCheck)
      
      for (const participantId of participantsToCheck) {
        // Double vérification : ne jamais vérifier l'organisateur
        if (participantId === dbUser.id) {
          console.error(`[UPDATE] ❌ ERREUR: Tentative de vérifier l'organisateur ${participantId}, ignoré (mode 4 participants)`)
          continue
        }
        
        const canCreateResult = await canUserCreateBooking(participantId, params.id)
        console.log(`[UPDATE] Participant ${participantId}: canCreate=${canCreateResult.canCreate}, activeCount=${canCreateResult.activeCount} (mode 4 participants)`)
        
        if (!canCreateResult.canCreate && canCreateResult.activeCount && canCreateResult.activeCount >= 2) {
          const participant = await prisma.user.findUnique({
            where: { id: participantId },
            select: { nom: true, prenom: true }
          })
          if (participant) {
            participantsWithQuotaIssues.push({
              id: participantId,
              name: `${participant.prenom} ${participant.nom}`,
              activeCount: canCreateResult.activeCount
            })
          }
        }
      }
      
      if (participantsWithQuotaIssues.length > 0) {
        const names = participantsWithQuotaIssues.map(p => `• ${p.name} : ${p.activeCount} réservation(s) active(s)`)
        return NextResponse.json(
          {
            error: 'Quota de réservations atteint pour certains participants',
            message: `Les participants suivants ont déjà atteint leur quota de 2 réservations actives :\n\n${names.join('\n')}\n\nVeuillez choisir d'autres participants.`
          },
          { status: 403 }
        )
      }

      // 6. Mettre à jour la réservation
      await prisma.booking.update({
        where: { id: params.id },
        data: {
          ticketsUtilises: 0,
          utiliseTickets: false,
          participants: {
            deleteMany: {},
            create: participantIds.map((participantId: string) => ({
              userId: participantId
            }))
          }
        }
      })
    }

    // Récupérer la réservation mise à jour
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
      message: ticketsToUse > 0
        ? `Réservation modifiée avec ${ticketsToUse} ticket(s)${participantsNecessaires > 0 ? ` et ${participantsNecessaires} participant(s)` : ''}.`
        : 'Tickets remplacés par 4 participants avec succès. Les tickets ont été restitués.'
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

