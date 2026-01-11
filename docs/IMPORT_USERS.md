# Guide d'import des utilisateurs

## Format du fichier d'import

Le système accepte deux formats de fichiers :
- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

### Colonnes requises

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `email` | Adresse email de l'utilisateur (unique) | `jean.dupont@st.com` |
| `matricule` | Matricule employé (unique) | `MAT001` |
| `nom` | Nom de famille | `Dupont` |
| `prenom` | Prénom | `Jean` |

### Colonnes optionnelles

| Colonne | Description | Valeur par défaut | Exemple |
|---------|-------------|-------------------|---------|
| `soldeCredits` | Nombre de crédits initiaux | `10` | `15` |
| `role` | Rôle utilisateur (USER, ADMIN, SUPER_ADMIN) | `USER` | `USER` |
| `password` | Mot de passe (généré automatiquement si absent) | Généré aléatoirement | `MonMotDePasse123!` |

## Exemple de fichier CSV

```csv
email,matricule,nom,prenom,soldeCredits,role
jean.dupont@st.com,MAT001,Dupont,Jean,10,USER
marie.martin@st.com,MAT002,Martin,Marie,15,USER
pierre.durand@st.com,MAT003,Durand,Pierre,10,USER
```

## Exemple de fichier Excel

Le fichier Excel doit avoir les mêmes colonnes que le CSV, avec la première ligne contenant les en-têtes.

## Processus d'import

1. **Télécharger le template** : Cliquez sur "Template Excel" ou "Template CSV" dans le panneau d'administration
2. **Remplir le fichier** : Ajoutez tous les utilisateurs à importer
3. **Importer** : Cliquez sur "Importer" et sélectionnez votre fichier
4. **Vérification** : Le système créera les utilisateurs dans Supabase Auth et dans la base de données

## Réinitialisation annuelle

À la fin de chaque année, vous pouvez :

1. **Bloquer tous les utilisateurs** : Cliquez sur "Bloquer tous (année)" pour bloquer tous les utilisateurs non-admin
2. **Débloquer individuellement** : Pour chaque utilisateur ayant payé sa cotisation, cliquez sur "Débloquer"
3. **Importer de nouveaux utilisateurs** : Utilisez la fonction d'import pour ajouter les nouveaux membres

## Notes importantes

- Les utilisateurs bloqués ne peuvent pas créer de réservations
- Les administrateurs ne peuvent pas être bloqués
- Les emails et matricules doivent être uniques
- Si un utilisateur existe déjà (même email), ses informations seront mises à jour
- Les mots de passe sont générés automatiquement s'ils ne sont pas fournis dans le fichier


