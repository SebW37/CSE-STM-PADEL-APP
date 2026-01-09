# Panel d'Administration CSE - Documentation

## Vue d'ensemble

Le panel d'administration permet aux gestionnaires du CSE de gérer les terrains, consulter les membres et analyser les statistiques.

## Accès

- **URL** : `/admin`
- **Protection** : Accès réservé aux utilisateurs avec le rôle `ADMIN`
- **Vérification** : Le rôle est vérifié côté serveur sur toutes les routes API admin

## Fonctionnalités

### 1. Gestion de la Maintenance

**Onglet "Maintenance"**

Permet de bloquer/débloquer les terrains pour maintenance ou travaux.

- **Activer un terrain** : Le terrain devient disponible pour les réservations
- **Mettre en maintenance** : Le terrain est désactivé et ne peut plus être réservé
- **Affichage** : Nombre de réservations à venir pour chaque terrain

**API** : `PATCH /api/admin/courts`
```json
{
  "courtId": "uuid",
  "actif": false  // true pour activer, false pour maintenance
}
```

### 2. Liste des Membres

**Onglet "Membres"**

Vue d'ensemble de tous les employés avec leur historique de jeu.

**Informations affichées** :
- Matricule, nom, prénom, email
- Solde de crédits
- Nombre total de réservations
- Dernières 10 réservations avec détails (date, terrain, statut)
- Badge "Admin" pour les administrateurs

**Pagination** : 20 membres par page

**API** : `GET /api/admin/members?page=1&limit=20`

### 3. Statistiques

**Onglet "Statistiques"**

Analyse du taux d'occupation des terrains avec graphiques.

**Graphique** :
- Barres montrant le taux d'occupation (%) par terrain
- Barres montrant le nombre de réservations par terrain
- Utilise Recharts pour le rendu

**Statistiques globales** :
- Total de réservations du mois
- Nombre d'utilisateurs actifs
- Taux moyen d'occupation
- Détails par terrain (slots occupés, taux d'occupation)

**Sélection de mois** : Navigation entre les mois pour consulter les statistiques passées

**Export CSV** : Bouton pour télécharger toutes les réservations du mois en CSV

**API** :
- `GET /api/admin/stats?month=2024-01` : Statistiques
- `GET /api/admin/export?month=2024-01` : Export CSV

## Configuration d'un Administrateur

### Méthode 1 : Script CLI

```bash
npm run admin:set john.doe@st.com
```

### Méthode 2 : Base de données

Mettre à jour directement dans la base de données :

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'john.doe@st.com';
```

### Méthode 3 : Prisma Studio

1. Lancer `npm run db:studio`
2. Ouvrir la table `users`
3. Modifier le champ `role` de `USER` à `ADMIN`

## Structure des API Routes Admin

Toutes les routes admin sont protégées et vérifient :
1. Authentification (utilisateur connecté)
2. Rôle admin (email vérifié dans la base)

### Routes disponibles

- `GET /api/admin/check` : Vérifier les droits admin
- `GET /api/admin/courts` : Liste des terrains avec statuts
- `PATCH /api/admin/courts` : Mettre à jour le statut d'un terrain
- `GET /api/admin/members` : Liste des membres avec historique
- `GET /api/admin/stats` : Statistiques d'occupation
- `GET /api/admin/export` : Export CSV des réservations

## Format du CSV exporté

Le fichier CSV contient les colonnes suivantes :
- ID
- Date
- Heure
- Durée (min)
- Terrain
- Matricule
- Nom
- Prénom
- Email
- Statut
- Crédits utilisés
- Date de création

Le fichier est encodé en UTF-8 avec BOM pour une compatibilité optimale avec Excel.

## Calcul du taux d'occupation

Le taux d'occupation est calculé comme suit :
- **Slots par jour** : 10 slots (4 de 90min le matin, 2 de 60min midi, 4 de 90min l'après-midi)
- **Total slots du mois** : Nombre de jours × 10
- **Slots occupés** : Nombre de réservations confirmées
- **Taux** : (Slots occupés / Total slots) × 100

## Sécurité

- Toutes les routes admin vérifient le rôle côté serveur
- Les utilisateurs non-admin sont redirigés vers `/dashboard`
- Les API routes retournent une erreur 403 si l'utilisateur n'est pas admin
- Le middleware Next.js laisse passer les routes `/admin`, mais la page vérifie les droits

## Améliorations possibles

- [ ] Ajouter un système de logs pour les actions admin
- [ ] Permettre l'annulation de réservations depuis l'admin
- [ ] Ajouter des filtres avancés dans la liste des membres
- [ ] Exporter les statistiques en PDF
- [ ] Ajouter des graphiques supplémentaires (évolution dans le temps, etc.)


