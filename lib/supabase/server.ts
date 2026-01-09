/**
 * Helpers Supabase pour les Server Components et Server Actions
 */
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Crée un client Supabase pour les Server Components
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerComponentClient({ cookies: () => cookieStore })
}

/**
 * Récupère l'utilisateur authentifié côté serveur
 * Note: La gestion des utilisateurs (création/modification) est réservée aux admins
 */
export async function getServerUser() {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Récupère la session côté serveur
 */
export async function getServerSession() {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}


