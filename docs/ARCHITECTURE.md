# Architecture - Application Réservation Padel CSE STM

## Vue d'ensemble

Application de type "Private Club" avec authentification SSO via Supabase, réservée aux employés STMicroelectronics.

## Contraintes implémentées

### ✅ Authentification
- **Supabase Auth** avec restriction aux emails `@st.com`
- Validation au niveau middleware Next.js
- Helpers d'authentification pour client et serveur

### ✅ Base de données (Prisma)
- **User** : Matricule, Nom, Prénom, Email, Solde de crédits
- **Booking** : Maximum 2 réservations actives par employé
- **Court** : Exactement 3 terrains fixes

### ✅ Règles métier
- Réservation possible **7 jours à l'avance maximum**
- Maximum **2 réservations actives** par employé
- Validation de disponibilité des terrains

## Schéma de base de données

### Modèle User
```prisma
model User {
  id            String    @id @default(uuid())
  matricule    String    @unique
  nom           String
  prenom        String
  email         String    @unique  // @st.com uniquement
  soldeCredits  Int       @default(0)
  bookings      Booking[]
}
```

### Modèle Court
```prisma
model Court {
  id          String    @id @default(uuid())
  numero      Int       @unique  // 1, 2, ou 3
  nom         String
  actif       Boolean   @default(true)
  bookings    Booking[]
}
```

### Modèle Booking
```prisma
model Booking {
  id            String        @id @default(uuid())
  userId        String
  courtId       String
  date          DateTime
  duree         Int           @default(60)
  statut        BookingStatus @default(CONFIRME)
  creditsUtilises Int         @default(1)
  user          User          @relation(...)
  court         Court         @relation(...)
}
```

## Sécurité

### Middleware Next.js (`middleware.ts`)
- ✅ Vérifie l'authentification sur toutes les routes (sauf publiques)
- ✅ Valide que l'email est `@st.com`
- ✅ Redirige vers `/auth/login` si non authentifié
- ✅ Déconnecte automatiquement les utilisateurs avec email non autorisé

### Validation des emails
- **Côté client** : `lib/supabase/auth-helpers.ts`
- **Côté serveur** : `lib/supabase/server.ts`
- **Middleware** : `middleware.ts`

## Règles métier (`lib/prisma/rules.ts`)

### `canUserCreateBooking(userId: string)`
Vérifie si un utilisateur peut créer une nouvelle réservation.
- Compte les réservations avec statut `CONFIRME` et date future
- Retourne `false` si >= 2 réservations actives

### `isBookingDateValid(bookingDate: Date)`
Vérifie si une date de réservation est valide.
- Date doit être dans le futur
- Date doit être dans les 7 prochains jours maximum

### `isCourtAvailable(courtId, date, duree)`
Vérifie si un terrain est disponible à une date/heure donnée.
- Vérifie les chevauchements avec les réservations existantes
- Prend en compte la durée de la réservation

### `ensureCourtsExist()`
Initialise les 3 terrains en base de données si ils n'existent pas.
- Court 1 : "Court Central"
- Court 2 : "Court Est"
- Court 3 : "Court Ouest"

## Flux d'authentification

1. **Connexion** : Utilisateur se connecte via Supabase Auth
2. **Validation middleware** : Vérifie que l'email est `@st.com`
3. **Création User** : Si l'utilisateur n'existe pas en base Prisma, le créer
4. **Accès** : Utilisateur peut accéder à l'application

## Flux de réservation

1. **Vérification utilisateur** : Authentifié et existe en base
2. **Vérification quota** : Moins de 2 réservations actives
3. **Vérification date** : Dans les 7 prochains jours
4. **Vérification disponibilité** : Terrain libre à cette date/heure
5. **Vérification crédits** : Solde suffisant
6. **Création réservation** : Créer la réservation et déduire les crédits

## Points d'extension

### Synchronisation User Prisma ↔ Supabase Auth
Créer un webhook Supabase qui crée automatiquement un `User` en base Prisma lors de la première connexion.

### Gestion des crédits
- Système de crédits déjà en place dans le modèle `User`
- Déduction automatique lors de la création d'une réservation
- Peut être étendu avec un système de recharge

### Notifications
Ajouter un système de notifications pour :
- Confirmation de réservation
- Rappel avant la réservation
- Annulation de réservation

## Prochaines étapes

1. Créer les pages Next.js (login, dashboard, réservation)
2. Implémenter la synchronisation User Prisma ↔ Supabase
3. Ajouter les tests unitaires pour les règles métier
4. Configurer les webhooks Supabase
5. Ajouter un système de notifications


