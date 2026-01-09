/**
 * Middleware de sécurité Next.js
 * Restreint l'accès aux utilisateurs authentifiés
 * Note: La gestion des utilisateurs (création/modification) est réservée aux admins
 */
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes publiques (accessibles sans authentification)
const PUBLIC_ROUTES = ['/auth/login', '/auth/callback', '/api/auth']

// Routes API publiques
const PUBLIC_API_ROUTES = ['/api/auth']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Vérifier la session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Vérifier si c'est une route publique
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isPublicApiRoute = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))

  // Si c'est une route publique, autoriser l'accès
  if (isPublicRoute || isPublicApiRoute) {
    return res
  }

  // Si pas de session, rediriger vers la page de connexion
  if (!session) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // La vérification du rôle admin se fait côté serveur dans la page /admin
  // Le middleware laisse passer toutes les routes authentifiées

  return res
}

// Configuration du middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

