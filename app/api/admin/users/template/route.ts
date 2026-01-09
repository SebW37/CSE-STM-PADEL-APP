/**
 * API Route pour télécharger un template de fichier d'import
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import * as XLSX from 'xlsx'

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

    const format = req.nextUrl.searchParams.get('format') || 'xlsx'

    // Données d'exemple
    const exampleData = [
      {
        email: 'exemple1@st.com',
        matricule: 'MAT001',
        nom: 'Dupont',
        prenom: 'Jean',
        soldeTickets: 10,
        role: 'USER'
      },
      {
        email: 'exemple2@st.com',
        matricule: 'MAT002',
        nom: 'Martin',
        prenom: 'Marie',
        soldeCredits: 15,
        role: 'USER'
      }
    ]

    if (format === 'csv') {
      // Générer CSV
      const headers = ['email', 'matricule', 'nom', 'prenom', 'soldeTickets', 'role']
      const csvRows = [
        headers.join(','),
        ...exampleData.map(row => [
          row.email,
          row.matricule,
          row.nom,
          row.prenom,
          row.soldeTickets,
          row.role
        ].join(','))
      ]
      const csv = csvRows.join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="template_import_utilisateurs.csv"'
        }
      })
    } else {
      // Générer Excel
      const worksheet = XLSX.utils.json_to_sheet(exampleData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Utilisateurs')
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="template_import_utilisateurs.xlsx"'
        }
      })
    }
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

