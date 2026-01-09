/**
 * API Route pour modifier/supprimer un utilisateur (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { UserRole } from '@prisma/client'

/**
 * PATCH : Modifier un utilisateur
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
    const { email, matricule, nom, prenom, soldeTickets, role, bloque } = body

    // Récupérer l'utilisateur actuel pour vérifier si l'email change
    const currentUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Si l'email change, mettre à jour dans Supabase Auth
    if (email && email !== currentUser.email) {
      const supabase = createSupabaseAdminClient()
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers?.users.find(u => u.email === currentUser.email)
      
      if (authUser) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authUser.id,
          { email: email }
        )
        
        if (updateError) {
          return NextResponse.json(
            { error: 'Erreur lors de la mise à jour de l\'email dans Supabase', message: updateError.message },
            { status: 400 }
          )
        }
      }
    }

    const updateData: any = {}
    if (email) updateData.email = email
    if (matricule) updateData.matricule = matricule
    if (nom) updateData.nom = nom
    if (prenom) updateData.prenom = prenom
    if (soldeTickets !== undefined) updateData.soldeTickets = soldeTickets
    if (role) updateData.role = role as UserRole
    if (bloque !== undefined) updateData.bloque = bloque

    const dbUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({ user: dbUser })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE : Supprimer un utilisateur
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

    // Récupérer l'utilisateur pour obtenir son email
    const dbUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Supprimer de Supabase Auth
    const supabase = createSupabaseAdminClient()
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers?.users.find(u => u.email === dbUser.email)
    
    if (authUser) {
      await supabase.auth.admin.deleteUser(authUser.id)
    }

    // Supprimer de Prisma (cascade supprimera les réservations)
    await prisma.user.delete({
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

