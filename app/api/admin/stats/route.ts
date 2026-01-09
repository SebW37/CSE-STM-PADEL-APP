/**
 * API Route pour les statistiques (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'

/**
 * GET : Récupérer les statistiques d'occupation des terrains
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

    // Vérifier que l'utilisateur est admin
    const isAdmin = await isUserAdminByEmail(user.email!)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Administrateur requis.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    
    // Par défaut, le mois en cours
    const targetDate = monthParam ? new Date(monthParam) : new Date()
    const monthStart = startOfMonth(targetDate)
    const monthEnd = endOfMonth(targetDate)

    // Récupérer tous les terrains
    const courts = await prisma.court.findMany({
      orderBy: { numero: 'asc' }
    })

    // Récupérer toutes les réservations confirmées du mois
    const bookings = await prisma.booking.findMany({
      where: {
        statut: 'CONFIRME',
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        court: true
      }
    })

    // Calculer le taux d'occupation par terrain
    const statsByCourt = courts.map(court => {
      const courtBookings = bookings.filter(b => b.courtId === court.id)
      
      // Calculer le nombre total de slots disponibles dans le mois
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
      let totalSlots = 0
      let occupiedSlots = 0

      daysInMonth.forEach(day => {
        // Générer les slots pour ce jour (simplifié)
        // 8h-12h : slots de 90min = 4 slots
        // 12h-14h : slots de 60min = 2 slots
        // 14h-20h : slots de 90min = 4 slots
        // Total : 10 slots par jour
        const slotsPerDay = 10
        totalSlots += slotsPerDay

        // Compter les réservations de ce jour pour ce terrain
        const dayBookings = courtBookings.filter(b => {
          const bookingDate = new Date(b.date)
          return bookingDate.toDateString() === day.toDateString()
        })
        
        occupiedSlots += dayBookings.length
      })

      const occupationRate = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0

      return {
        courtId: court.id,
        courtNumero: court.numero,
        courtNom: court.nom,
        totalSlots,
        occupiedSlots,
        occupationRate: Math.round(occupationRate * 100) / 100,
        totalBookings: courtBookings.length
      }
    })

    // Statistiques globales
    const totalBookings = bookings.length
    const totalUsers = await prisma.user.count()
    const activeUsers = await prisma.user.count({
      where: {
        bookings: {
          some: {
            statut: 'CONFIRME',
            date: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        }
      }
    })

    return NextResponse.json({
      period: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
        month: monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      },
      courts: statsByCourt,
      global: {
        totalBookings,
        totalUsers,
        activeUsers,
        averageOccupationRate: statsByCourt.reduce((sum, c) => sum + c.occupationRate, 0) / statsByCourt.length
      }
    })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

