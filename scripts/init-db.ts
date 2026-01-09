/**
 * Script d'initialisation de la base de données
 * Crée les 3 terrains requis si ils n'existent pas
 */
import { prisma } from '../lib/prisma/client'
import { ensureCourtsExist } from '../lib/prisma/rules'

async function main() {
  console.log('🚀 Initialisation de la base de données...')

  try {
    // Vérifier et créer les terrains
    await ensureCourtsExist()
    console.log('✅ Terrains initialisés (3 terrains)')

    // Vérifier le nombre de terrains
    const courtsCount = await prisma.court.count()
    console.log(`📊 Nombre de terrains en base : ${courtsCount}`)

    if (courtsCount === 3) {
      console.log('✅ Contrainte respectée : exactement 3 terrains')
    } else {
      console.warn(`⚠️  Attention : ${courtsCount} terrains au lieu de 3`)
    }

    // Lister les terrains
    const courts = await prisma.court.findMany({
      orderBy: { numero: 'asc' }
    })
    console.log('\n📋 Terrains disponibles :')
    courts.forEach(court => {
      console.log(`   - Court ${court.numero}: ${court.nom} (${court.actif ? 'Actif' : 'Inactif'})`)
    })

    console.log('\n✅ Initialisation terminée avec succès')
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation :', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


