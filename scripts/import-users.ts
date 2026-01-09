/**
 * Script pour importer une liste d'utilisateurs
 * Usage: tsx scripts/import-users.ts
 * 
 * Les utilisateurs seront créés dans Supabase Auth et en base Prisma
 */
import { createSupabaseAdminClient } from '../lib/supabase/client'
import { prisma } from '../lib/prisma/client'

interface UserToImport {
  email: string
  password: string
  matricule: string
  nom: string
  prenom: string
  soldeCredits?: number
}

// Liste des utilisateurs à importer
const usersToImport: UserToImport[] = [
  {
    email: 'lucas.deshors@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT002',
    nom: 'Deshors',
    prenom: 'Lucas',
    soldeCredits: 10
  },
  {
    email: 'gwen.yann@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT003',
    nom: 'Yann',
    prenom: 'Gwen',
    soldeCredits: 10
  },
  {
    email: 'yoann.fages@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT004',
    nom: 'Fages',
    prenom: 'Yoann',
    soldeCredits: 10
  },
  {
    email: 'remi.chakarian@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT005',
    nom: 'Chakarian',
    prenom: 'Remi',
    soldeCredits: 10
  },
  {
    email: 'romain.clary@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT006',
    nom: 'Clary',
    prenom: 'Romain',
    soldeCredits: 10
  },
  {
    email: 'romeric.gay@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT007',
    nom: 'Gay',
    prenom: 'Romeric',
    soldeCredits: 10
  },
  {
    email: 'cedric.dagon@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT008',
    nom: 'Dagon',
    prenom: 'Cedric',
    soldeCredits: 10
  },
  {
    email: 'adam.escales@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT009',
    nom: 'Escales',
    prenom: 'Adam',
    soldeCredits: 10
  },
  {
    email: 'alexis.rey@st.com',
    password: 'CSE2024Padel!',
    matricule: 'MAT010',
    nom: 'Rey',
    prenom: 'Alexis',
    soldeCredits: 10
  },
]

async function main() {
  try {
    if (usersToImport.length === 0) {
      console.log('⚠️  Aucun utilisateur à importer. Modifiez le tableau usersToImport dans le script.')
      process.exit(0)
    }

    const supabase = createSupabaseAdminClient()
    let successCount = 0
    let errorCount = 0

    console.log(`🚀 Import de ${usersToImport.length} utilisateur(s)...\n`)

    for (const userData of usersToImport) {
      try {
        // Vérifier que l'email est @st.com
        if (!userData.email.toLowerCase().endsWith('@st.com')) {
          console.error(`❌ ${userData.email}: Email doit être @st.com`)
          errorCount++
          continue
        }

        // Créer l'utilisateur dans Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            console.log(`⚠️  ${userData.email}: Existe déjà dans Supabase Auth`)
          } else {
            throw authError
          }
        }

        // Créer/mettre à jour l'utilisateur en base Prisma
        const dbUser = await prisma.user.upsert({
          where: { email: userData.email },
          update: {
            nom: userData.nom,
            prenom: userData.prenom,
            matricule: userData.matricule,
            soldeCredits: userData.soldeCredits ?? 10
          },
          create: {
            email: userData.email,
            nom: userData.nom,
            prenom: userData.prenom,
            matricule: userData.matricule,
            soldeCredits: userData.soldeCredits ?? 10
          }
        })

        console.log(`✅ ${userData.prenom} ${userData.nom} (${userData.email}) - Matricule: ${userData.matricule}`)
        successCount++

      } catch (error: any) {
        console.error(`❌ Erreur pour ${userData.email}:`, error.message)
        errorCount++
      }
    }

    console.log(`\n📊 Résumé:`)
    console.log(`   ✅ Réussis: ${successCount}`)
    console.log(`   ❌ Erreurs: ${errorCount}`)
    console.log(`   📝 Total: ${usersToImport.length}`)

  } catch (error: any) {
    console.error('❌ Erreur générale:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
