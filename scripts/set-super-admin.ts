/**
 * Script pour promouvoir un utilisateur en super administrateur
 * Usage: tsx scripts/set-super-admin.ts <email>
 */
import { prisma } from '../lib/prisma/client'
import { UserRole } from '@prisma/client'

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Usage: tsx scripts/set-super-admin.ts <email>')
    console.error('   Exemple: tsx scripts/set-super-admin.ts sebastien.wegel@st.com')
    process.exit(1)
  }

  if (!email.toLowerCase().endsWith('@st.com')) {
    console.error('❌ L\'email doit être un compte @st.com')
    process.exit(1)
  }

  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}...`)

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ Utilisateur non trouvé avec l'email: ${email}`)
      console.error('   Assurez-vous que l\'utilisateur s\'est connecté au moins une fois.')
      process.exit(1)
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      console.log(`✅ L'utilisateur ${email} est déjà super administrateur.`)
      process.exit(0)
    }

    await prisma.user.update({
      where: { email },
      data: { role: UserRole.SUPER_ADMIN }
    })

    console.log(`✅ ${user.prenom} ${user.nom} (${email}) a été promu super administrateur.`)
    console.log(`   L'utilisateur peut maintenant accéder à toutes les fonctionnalités admin et super admin.`)
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


