# GestionSco

Application de gestion scolaire (candidats, présences, notes, résultats, statistiques).
Stack : React + Vite + TypeScript + Tailwind + shadcn/ui, backend Supabase (base, auth, stockage, Edge Functions).

## 1. Configurer Supabase

1. Créez un projet sur https://supabase.com.
2. Installez la CLI Supabase, puis dans ce dossier :
   ```sh
   supabase login
   supabase link --project-ref VOTRE_PROJECT_REF
   supabase db push                 # applique tout le schéma (supabase/migrations)
   supabase functions deploy        # déploie les 7 Edge Functions
   ```
3. Mettez à jour `project_id` dans `supabase/config.toml` avec votre référence de projet.
4. Authentication > URL Configuration : ajoutez l'URL de votre site déployé (Site URL + Redirect URLs).
5. Vérifiez dans Storage que le bucket public `profile-photos` existe (créé par les migrations ; sinon créez-le).
6. Recréez vos comptes administrateur (les données et utilisateurs de l'ancien projet ne sont pas dans le code).

Les Edge Functions n'ont besoin d'aucun secret à ajouter : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.

## 2. Brancher VOTRE Supabase

Ouvrez `src/integrations/supabase/client.ts` et remplacez `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` par ceux de votre projet (Project Settings > API). Les tables sont dans `supabase/migrations` et leurs types dans `src/integrations/supabase/types.ts`.

## 3. Lancer en local

```sh
npm install
npm run dev
```

## 4. Déployer (Vercel, Netlify ou Cloudflare Pages)

- Commande de build : `npm run build`
- Dossier de sortie : `dist`
- Aucune variable d'environnement requise : l'URL et la clé publique Supabase sont écrites en dur dans `src/integrations/supabase/client.ts`.
- La redirection SPA est déjà fournie (`vercel.json` pour Vercel, `public/_redirects` pour Netlify/Cloudflare).

## Extraction des candidats depuis les PDF (sans IA)

La fonction `supabase/functions/extract-candidates` lit la position du texte dans le PDF et lit le tableau
colonne par colonne (N° de table, Nom, Prénom(s), Sexe, École de provenance). Aucun service d'IA ni clé API.
- Le PDF doit contenir du texte sélectionnable (pas un scan).
- La ligne d'en-tête du tableau (Nom, Prénom(s), Sexe, École de provenance…) doit être présente.
- La logique est dans `parser.ts` ; si un libellé de colonne diffère de vos PDF, adaptez `HEADER_RULES`.
- Tests : `npm test`.

## Outils du compte école CM2

Quand la classe du profil d'un compte école est **CM2**, le menu « Dossiers CM2 > Photos et fiches scolaires » apparaît :
- import de la liste des apprenants (PDF avec texte, Excel, CSV) ;
- renommage des photos en `matricule_nom_prénoms.jpg` (téléchargement en ZIP) ;
- fiche scolaire (impression ou PDF) : identité, matricule, école, dates ; photo facultative.

Tout se passe dans le navigateur (rien n'est envoyé sur un serveur). Les notes des classes passées ne sont jamais inventées :
elles ne sont écrites que si la liste contient des colonnes de moyennes (ex. « Moyenne CE2 »).
Les bibliothèques PDF/Excel/ZIP sont chargées depuis cdnjs au premier usage (connexion internet requise).
Code : `src/components/school/Cm2Tools.tsx` et `src/lib/cm2-tools.ts`.

L'administrateur dispose du même outil dans l'onglet « Dossiers écoles » : il choisit l'école (ou saisit un nom libre), importe la liste et les photos, puis génère les fiches. La « Fiche individuelle des candidats » est affichée comme « à venir » dans les deux comptes.
