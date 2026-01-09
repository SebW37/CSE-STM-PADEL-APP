/**
 * Script pour initialiser les tickets de tous les utilisateurs à 3
 * Usage: tsx scripts/init-tickets.ts
 */
import { prisma } from '../lib/prisma/client'

async function main() {
  console.log('🎫 Initialisation des tickets de tous les utilisateurs à 3...\n')

  try {
    // Mettre à jour tous les utilisateurs pour leur donner 3 tickets
    const result = await prisma.user.updateMany({
      data: {
        soldeTickets: 3
      }
    })

    console.log(`✅ ${result.count} utilisateur(s) mis à jour avec 3 tickets.`)
    
    // Afficher un résumé
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        soldeTickets: true
      },
      orderBy: {
        email: 'asc'
      }
    })

    console.log('\n📊 Résumé des tickets:')
    console.log('─'.repeat(60))
    users.forEach(user => {
      console.log(`  ${user.prenom} ${user.nom} (${user.email}): ${user.soldeTickets} tickets`)
    })
    console.log('─'.repeat(60))
    console.log(`\n✅ Total: ${users.length} utilisateur(s) avec 3 tickets chacun.`)
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

