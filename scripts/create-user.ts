/**
 * Script pour créer un utilisateur Supabase Auth et l'enregistrer en base Prisma
 * Usage: tsx scripts/create-user.ts <email> <password> <matricule> <nom> <prenom>
 */
import { createSupabaseAdminClient } from '../lib/supabase/client'
import { prisma } from '../lib/prisma/client'

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const matricule = process.argv[4] || 'MAT001'
  const nom = process.argv[5] || 'Wegel'
  const prenom = process.argv[6] || 'Sebastien'

  if (!email || !password) {
    console.error('❌ Usage: tsx scripts/create-user.ts <email> <password> [matricule] [nom] [prenom]')
    console.error('   Exemple: tsx scripts/create-user.ts sebastien.wegel@st.com MonMotDePasse123! MAT001 Wegel Sebastien')
    process.exit(1)
  }

  if (!email.toLowerCase().endsWith('@st.com')) {
    console.error('❌ L\'email doit être un compte @st.com')
    process.exit(1)
  }

  try {
    console.log(`🔍 Création de l'utilisateur: ${email}...`)

    // Créer l'utilisateur dans Supabase Auth
    const supabase = createSupabaseAdminClient()
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Confirmer l'email automatiquement
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  L'utilisateur ${email} existe déjà dans Supabase Auth`)
      } else {
        throw authError
      }
    } else {
      console.log(`✅ Utilisateur créé dans Supabase Auth: ${authUser.user?.id}`)
    }

    // Récupérer l'utilisateur (créé ou existant)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.email === email)

    if (!user) {
      throw new Error('Utilisateur non trouvé après création')
    }

    // Créer l'utilisateur en base Prisma
    const dbUser = await prisma.user.upsert({
      where: { email },
      update: {
        nom,
        prenom,
        matricule
      },
      create: {
        email,
        nom,
        prenom,
        matricule,
        soldeCredits: 10 // Crédits de départ
      }
    })

    console.log(`✅ Utilisateur créé/mis à jour en base Prisma:`)
    console.log(`   - ID: ${dbUser.id}`)
    console.log(`   - Matricule: ${dbUser.matricule}`)
    console.log(`   - Nom: ${dbUser.prenom} ${dbUser.nom}`)
    console.log(`   - Email: ${dbUser.email}`)
    console.log(`   - Crédits: ${dbUser.soldeCredits}`)
    console.log(`\n✅ Vous pouvez maintenant vous connecter avec:`)
    console.log(`   Email: ${email}`)
    console.log(`   Mot de passe: ${password}`)

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

