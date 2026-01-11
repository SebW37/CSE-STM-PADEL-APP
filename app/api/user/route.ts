/**
 * API Route pour récupérer les informations de l'utilisateur connecté
 */
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET() {
  const startTime = Date.now()
  console.log('[API /user] ========================================')
  console.log('[API /user] Début de la requête GET /api/user')
  console.log('[API /user] Environnement:', process.env.NODE_ENV)
  console.log('[API /user] DATABASE_URL défini:', !!process.env.DATABASE_URL)
  
  // Forcer l'affichage des logs même en production
  process.stdout.write('[API /user] TEST LOG\n')
  
  try {
    // Étape 1: Récupération de l'utilisateur Supabase
    console.log('[API /user] Étape 1: Récupération utilisateur Supabase...')
    let user
    try {
      user = await getServerUser()
      if (!user) {
        console.error('[API /user] Étape 1 ÉCHEC: Utilisateur non authentifié')
        return NextResponse.json(
          { error: 'Non authentifié' },
          { status: 401 }
        )
      }
      console.log('[API /user] Étape 1 OK: Email utilisateur =', user.email)
    } catch (err: any) {
      console.error('[API /user] Étape 1 ERREUR:', err.message)
      console.error('[API /user] Stack:', err.stack)
      throw new Error(`Erreur lors de la récupération Supabase: ${err.message}`)
    }

    // Étape 2: Récupération de l'utilisateur en base de données
    console.log('[API /user] Étape 2: Récupération utilisateur en DB...')
    let dbUser
    try {
      dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          soldeTickets: true,
          role: true,
          bloque: true
        }
      })

      if (!dbUser) {
        console.error('[API /user] Étape 2 ÉCHEC: Utilisateur non trouvé pour email:', user.email)
        return NextResponse.json(
          { error: 'Utilisateur non trouvé en base de données', email: user.email },
          { status: 404 }
        )
      }
      console.log('[API /user] Étape 2 OK: Utilisateur trouvé, ID =', dbUser.id)
    } catch (err: any) {
      console.error('[API /user] Étape 2 ERREUR Prisma:', err.message)
      console.error('[API /user] Code erreur:', err.code)
      console.error('[API /user] Stack:', err.stack)
      throw new Error(`Erreur Prisma lors de la récupération utilisateur: ${err.message} (code: ${err.code})`)
    }

    // Étape 3: Récupération des réservations
    console.log('[API /user] Étape 3: Récupération des réservations...')
    let bookings = []
    try {
      bookings = await prisma.booking.findMany({
        where: {
          userId: dbUser.id,
          statut: 'CONFIRME',
          date: {
            gte: new Date()
          }
        },
        include: {
          court: true,
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
        },
        take: 10
      })
      console.log('[API /user] Étape 3 OK:', bookings.length, 'réservations trouvées')
    } catch (err: any) {
      console.error('[API /user] Étape 3 ERREUR Prisma:', err.message)
      console.error('[API /user] Code erreur:', err.code)
      console.error('[API /user] Stack:', err.stack)
      // Ne pas faire échouer la requête si les bookings échouent
      console.warn('[API /user] Continuons sans les réservations...')
      bookings = []
    }

    // Étape 4: Récupération des participations (en excluant celles où l'utilisateur est aussi organisateur)
    console.log('[API /user] Étape 4: Récupération des participations...')
    let participations = []
    try {
      participations = await prisma.bookingParticipant.findMany({
        where: {
          userId: dbUser.id,
          booking: {
            statut: 'CONFIRME',
            date: {
              gte: new Date()
            },
            userId: {
              not: dbUser.id // Exclure celles où il est aussi organisateur
            }
          }
        },
        include: {
          booking: {
            include: {
              court: true,
              user: {
                select: {
                  nom: true,
                  prenom: true
                }
              }
            }
          }
        },
        orderBy: {
          booking: {
            date: 'asc'
          }
        },
        take: 10
      })
      console.log('[API /user] Étape 4 OK:', participations.length, 'participations trouvées')
    } catch (err: any) {
      console.error('[API /user] Étape 4 ERREUR Prisma:', err.message)
      console.error('[API /user] Code erreur:', err.code)
      console.error('[API /user] Stack:', err.stack)
      // Ne pas faire échouer la requête si les participations échouent
      console.warn('[API /user] Continuons sans les participations...')
      participations = []
    }

    // Étape 5: Construction de la réponse
    console.log('[API /user] Étape 5: Construction de la réponse...')
    const response = {
      user: {
        ...dbUser,
        bookings,
        participations
      }
    }

    const duration = Date.now() - startTime
    console.log('[API /user] SUCCÈS: Réponse construite en', duration, 'ms')
    
    return NextResponse.json(response)

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[API /user] ÉCHEC GLOBAL après', duration, 'ms')
    console.error('[API /user] Type d\'erreur:', error.constructor.name)
    console.error('[API /user] Message:', error.message)
    console.error('[API /user] Code:', error.code)
    console.error('[API /user] Stack trace complète:')
    console.error(error.stack)
    
    // Informations supplémentaires selon le type d'erreur
    if (error.name === 'PrismaClientKnownRequestError') {
      console.error('[API /user] Erreur Prisma connue - Code:', error.code)
      console.error('[API /user] Meta:', JSON.stringify(error.meta, null, 2))
    } else if (error.name === 'PrismaClientValidationError') {
      console.error('[API /user] Erreur de validation Prisma')
    } else if (error.name === 'PrismaClientInitializationError') {
      console.error('[API /user] Erreur d\'initialisation Prisma - Vérifiez DATABASE_URL')
    }

    return NextResponse.json(
      { 
        error: 'Erreur serveur', 
        message: error.message,
        code: error.code,
        type: error.constructor.name,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          meta: error.meta
        } : undefined
      },
      { status: 500 }
    )
  }
}


