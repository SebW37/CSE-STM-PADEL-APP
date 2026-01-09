/**
 * API Route pour l'export CSV des réservations (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { startOfMonth, endOfMonth, format } from 'date-fns'

/**
 * GET : Exporter les réservations du mois en CSV
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

    // Récupérer toutes les réservations du mois
    const bookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        user: {
          select: {
            matricule: true,
            nom: true,
            prenom: true,
            email: true
          }
        },
        court: {
          select: {
            numero: true,
            nom: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // Générer le CSV
    const csvHeaders = [
      'ID',
      'Date',
      'Heure',
      'Durée (min)',
      'Terrain',
      'Matricule',
      'Nom',
      'Prénom',
      'Email',
      'Statut',
      'Crédits utilisés',
      'Date de création'
    ]

    const csvRows = bookings.map(booking => {
      const bookingDate = new Date(booking.date)
      return [
        booking.id,
        format(bookingDate, 'dd/MM/yyyy'),
        format(bookingDate, 'HH:mm'),
        booking.duree,
        `Terrain ${booking.court.numero} - ${booking.court.nom}`,
        booking.user.matricule,
        booking.user.nom,
        booking.user.prenom,
        booking.user.email,
        booking.statut,
        booking.creditsUtilises,
        format(new Date(booking.createdAt), 'dd/MM/yyyy HH:mm')
      ]
    })

    // Convertir en CSV
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Ajouter le BOM pour Excel
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent

    // Retourner le fichier CSV
    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reservations_${format(monthStart, 'yyyy-MM')}.csv"`
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


