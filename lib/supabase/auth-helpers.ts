/**
 * Helpers d'authentification Supabase
 * Note: La gestion des utilisateurs (création/modification) est réservée aux admins
 */

import { createSupabaseServerClient } from './client'

/**
 * Récupère l'utilisateur actuel depuis Supabase Auth
 */
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient()
  
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
 * Récupère la session actuelle
 */
export async function getCurrentSession() {
  const supabase = createSupabaseServerClient()
  
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}


