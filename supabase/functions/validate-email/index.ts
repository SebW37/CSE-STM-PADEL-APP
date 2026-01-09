/**
 * Supabase Edge Function pour valider les emails @st.com
 * À déployer dans Supabase Functions
 * 
 * Usage: Créer une fonction Supabase Edge Function et l'appeler lors de l'inscription
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_DOMAIN = '@st.com'

serve(async (req) => {
  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const emailLower = email.toLowerCase()
    const isAllowed = emailLower.endsWith(ALLOWED_DOMAIN.toLowerCase())

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Accès réservé aux employés STMicroelectronics',
          message: 'L\'email doit être un compte @st.com'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})


