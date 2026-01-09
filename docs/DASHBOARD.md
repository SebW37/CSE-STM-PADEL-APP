# Dashboard de Réservation - Documentation

## Vue d'ensemble

Le dashboard "One-Page" offre une vue planning globale avec 3 colonnes (une par terrain) et des slots de réservation.

## Fonctionnalités

### Header
- **Logo ST Micro / CSE** : Logo et titre de l'application
- **Profil utilisateur** : Nom, prénom, email
- **Résumé** : 
  - Nombre de réservations à venir
  - Solde de crédits
  - Prochaine réservation

### Grille de Planning

#### Structure
- **3 colonnes** : Une par terrain (Terrain 1, Terrain 2, Terrain 3)
- **Slots horaires** :
  - **90 minutes** : Slots standards (8h-12h et 14h-20h)
  - **60 minutes** : Slots entre 12h et 14h (période déjeuner)

#### Logique de couleur
- **Gris** : Slots passés (non cliquables)
- **Rouge** : Slots occupés (affiche "Réservé" + nom du réservateur)
- **Vert** : Slots libres (cliquables pour réserver)
- **Bleu** : Ma réservation (cliquable, affiche "Ma réservation")

#### Navigation
- Boutons précédent/suivant pour changer de jour
- Bouton "Aujourd'hui" pour revenir à la date actuelle
- Affichage de la date sélectionnée

## Validation des réservations

### Contraintes vérifiées
1. **Quota de réservations simultanées** : Maximum 2 réservations actives en même temps
2. **Date valide** : Réservation possible jusqu'à 7 jours à l'avance
3. **Disponibilité** : Le terrain doit être libre à cette date/heure
4. **Crédits** : L'utilisateur doit avoir suffisamment de crédits

### Messages d'erreur
- "Quota de réservations atteint" : L'utilisateur a déjà 2 réservations actives simultanées
- "Date invalide" : La réservation dépasse les 7 jours
- "Terrain non disponible" : Le terrain est déjà réservé
- "Crédits insuffisants" : Solde de crédits insuffisant

## API Routes

### GET /api/user
Récupère les informations de l'utilisateur connecté et ses réservations à venir.

### GET /api/courts
Récupère la liste des 3 terrains.

### GET /api/bookings
Récupère les réservations pour une période donnée.
- Query params : `startDate`, `endDate` (optionnels)

### POST /api/bookings
Crée une nouvelle réservation.
- Body : `{ courtId, date, duree }`

## Structure des composants

### DashboardHeader
Affiche le header avec logo, profil et résumé.

### PlanningGrid
Affiche la grille de planning avec les 3 colonnes de terrains.

## Logique des slots

Les slots sont générés par la fonction `generateDaySlots()` dans `lib/planning/slots.ts` :

- **8h-12h** : Slots de 90 minutes
- **12h-14h** : Slots de 60 minutes (période déjeuner)
- **14h-20h** : Slots de 90 minutes

Exemple de slots générés :
- 08:00 (90min) → 09:30
- 09:30 (90min) → 11:00
- 11:00 (90min) → 12:30
- 12:00 (60min) → 13:00
- 13:00 (60min) → 14:00
- 14:00 (90min) → 15:30
- etc.

## Utilisation

1. Accéder à `/dashboard`
2. Sélectionner un jour avec les boutons de navigation
3. Cliquer sur un slot vert (libre) pour réserver
4. Confirmer la réservation
5. La grille se met à jour automatiquement

## Améliorations possibles

- [ ] Ajouter un système de notifications
- [ ] Permettre l'annulation de réservations
- [ ] Ajouter un calendrier pour sélectionner la date
- [ ] Afficher une vue semaine complète
- [ ] Ajouter des filtres (mes réservations, terrains spécifiques)


