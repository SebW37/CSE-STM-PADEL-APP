/**
 * Script pour supprimer toutes les réservations de la base de données
 */
import { prisma } from '../lib/prisma/client'
import { BookingStatus } from '@prisma/client'

async function main() {
  console.log('🗑️  Suppression de toutes les réservations...\n')

  try {
    // Compter les réservations avant suppression
    const countBefore = await prisma.booking.count()
    console.log(`📊 ${countBefore} réservation(s) trouvée(s)`)

    if (countBefore === 0) {
      console.log('✅ Aucune réservation à supprimer.')
      return
    }

    // Supprimer toutes les réservations (les participants seront supprimés en cascade)
    const result = await prisma.booking.deleteMany({})

    console.log(`✅ ${result.count} réservation(s) supprimée(s) avec succès.`)
    
    // Vérifier qu'il ne reste rien
    const countAfter = await prisma.booking.count()
    if (countAfter === 0) {
      console.log('✅ Base de données nettoyée.')
    } else {
      console.log(`⚠️  Il reste ${countAfter} réservation(s) en base.`)
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


