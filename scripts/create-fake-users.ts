/**
 * Script pour créer 30 faux utilisateurs pour les tests
 */
import { prisma } from '../lib/prisma/client'
import { UserRole } from '@prisma/client'

// Liste de prénoms et noms français courants
const prenoms = [
  'Thomas', 'Pierre', 'Nicolas', 'Antoine', 'Julien', 'Maxime', 'Alexandre', 'David',
  'Sébastien', 'Vincent', 'Julien', 'Romain', 'Baptiste', 'Guillaume', 'Matthieu',
  'Sophie', 'Marie', 'Julie', 'Camille', 'Claire', 'Emilie', 'Laura', 'Sarah',
  'Pauline', 'Marion', 'Céline', 'Audrey', 'Aurélie', 'Nathalie', 'Isabelle'
]

const noms = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Lefevre',
  'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez'
]

async function main() {
  const numUsers = 30
  console.log(`👥 Création de ${numUsers} faux utilisateurs...\n`)

  try {
    const createdUsers = []

    for (let i = 0; i < numUsers; i++) {
      const prenom = prenoms[Math.floor(Math.random() * prenoms.length)]
      const nom = noms[Math.floor(Math.random() * noms.length)]
      const matricule = `FAKE${String(i + 1).padStart(4, '0')}`
      const email = `fake.${prenom.toLowerCase()}.${nom.toLowerCase()}@st.com`

      // Vérifier si l'utilisateur existe déjà
      const existing = await prisma.user.findUnique({
        where: { email }
      })

      if (existing) {
        console.log(`⏭️  Utilisateur ${email} existe déjà, ignoré.`)
        continue
      }

      const user = await prisma.user.create({
        data: {
          matricule,
          nom,
          prenom,
          email,
          soldeCredits: 10, // Attribuer 10 crédits pour les tests
          role: UserRole.USER
        }
      })

      createdUsers.push(user)
      console.log(`✅ ${i + 1}. ${prenom} ${nom} (${email}) - Matricule: ${matricule}`)
    }

    console.log(`\n📊 Résumé:`)
    console.log(`   ✅ ${createdUsers.length} utilisateur(s) créé(s)`)
    console.log(`   💳 10 crédits attribués à chaque utilisateur`)
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


