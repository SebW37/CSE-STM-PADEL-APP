/**
 * API Route pour modifier/supprimer un blocage de plage horaire (Admin uniquement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { isUserAdminByEmail } from '@/lib/auth/roles'

/**
 * PATCH : Modifier un blocage
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
    const { courtId, date, startTime, endTime, raison, actif } = body

    const updateData: any = {}
    if (courtId !== undefined) updateData.courtId = courtId || null
    if (date) updateData.date = new Date(date)
    if (startTime) updateData.startTime = startTime
    if (endTime) updateData.endTime = endTime
    if (raison !== undefined) updateData.raison = raison
    if (actif !== undefined) updateData.actif = actif

    const block = await prisma.timeSlotBlock.update({
      where: { id: params.id },
      data: updateData,
      include: {
        court: true
      }
    })

    return NextResponse.json({ block })
  } catch (error: any) {
    console.error('Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE : Supprimer un blocage
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

    await prisma.timeSlotBlock.delete({
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


