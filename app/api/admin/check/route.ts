/**
 * API Route pour vérifier les droits admin
 */
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { isUserAdminByEmail } from '@/lib/auth/roles'

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const isAdmin = await isUserAdminByEmail(user.email!)
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      )
    }

    return NextResponse.json({ isAdmin: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}


