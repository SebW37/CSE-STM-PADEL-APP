/**
 * API Route pour récupérer les informations de l'utilisateur connecté
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

    // Récupérer l'utilisateur en base
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      include: {
        bookings: {
          where: {
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
          take: 10 // Limiter aux 10 prochaines réservations
        },
        participations: {
          where: {
            booking: {
              statut: 'CONFIRME',
              date: {
                gte: new Date()
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
        }
      }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé en base de données' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user: dbUser })
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


