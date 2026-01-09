/**
 * Gestion des rôles utilisateur
 */
import { prisma } from '@/lib/prisma/client'
import { UserRole } from '@prisma/client'

/**
 * Vérifie si un utilisateur est administrateur
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
}

/**
 * Vérifie si un utilisateur est super administrateur
 */
export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  return user?.role === UserRole.SUPER_ADMIN
}

/**
 * Vérifie si un utilisateur est administrateur par email
 */
export async function isUserAdminByEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  })

  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
}

/**
 * Vérifie si un utilisateur est super administrateur par email
 */
export async function isUserSuperAdminByEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true }
  })

  return user?.role === UserRole.SUPER_ADMIN
}

/**
 * Définit un utilisateur comme administrateur
 */
export async function setUserAsAdmin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.ADMIN }
  })
}

/**
 * Définit un utilisateur comme super administrateur
 */
export async function setUserAsSuperAdmin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.SUPER_ADMIN }
  })
}

/**
 * Définit un utilisateur comme utilisateur normal
 */
export async function setUserAsNormal(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.USER }
  })
}
