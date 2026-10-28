# Spécifications fonctionnelles — Plateforme de suivi des seniors pour les CCAS

> Version : 0.2 (brouillon PO) — 2026-10-28
> Statut : à valider. Les points marqués **[À CONFIRMER]** restent ouverts.
> Sources : notes client, formulaire « Plan Alerte et Urgence 2026 » (Maison des seniors, Lomme), « Guide d'entretien téléphonique : plan canicule ».
> **Objectif immédiat : un POC visuel** (cf. §10) ; le reste du document décrit la cible produit.
> Convention : chaque exigence a un identifiant stable (`E3-US2`, `RG-04`…) pour pouvoir être découpée ensuite en to-do list / tickets.
> Priorités MoSCoW : **M** = Must (MVP), **S** = Should (V1), **C** = Could (V2+), **W** = Won't (hors périmètre pour l'instant).

---

## 0. Vision

### 0.1 Problème
Les CCAS gèrent aujourd'hui le registre des personnes vulnérables (registre canicule / grand froid, art. L121-6-1 du CASF) de manière ponctuelle, souvent sur Excel, et uniquement pendant les crises. Résultat :
- les données sont obsolètes au moment de la crise (numéros faux, personnes absentes, décédées, déménagées) ;
- on appelle des personnes qui sont déjà vues le jour même par une aide à domicile ou une infirmière (doublons) ;
- on perd du temps à chercher qui appeler quand la personne ne répond pas ;
- les bénévoles mobilisés en urgence ont accès à trop d'informations ou à des outils trop complexes ;
- aucun pilotage chiffré n'est possible (combien de personnes jointes, qui reste à risque…).

### 0.1 bis Processus actuel observé (documents client)
- **Inscription** : formulaire papier « Plan Alerte et Urgence (PAU) » à renvoyer ou déposer à la Maison des seniors. Il peut couvrir **2 personnes d'un même foyer**, peut être rempli par un tiers, et **ne contient aucun critère de priorité** (le ranking est donc à calculer par la plateforme, cf. RG-01).
- **Appels** : un guide d'entretien papier ; le résultat et la date sont notés **dans un tableau Excel**. Si pas de réponse → appel de la personne contact. Rappel **quotidien tant que le plan est activé**. Besoin de visite → remontée à la Maison des seniors.
- **Périmètre réel** : le registre inclut les **personnes de 60 ans et +** et les **personnes en situation de handicap de moins de 60 ans** → on parle de « personnes vulnérables », pas uniquement de seniors.
- **Rétention annoncée aux usagers** : 1 an après inscription effective.

### 0.2 Objectif produit
Un outil **utilisé toute l'année** par le CCAS pour connaître et suivre les seniors de la commune, qui devient **l'outil de pilotage de crise** dès qu'une alerte est déclenchée.

### 0.3 Principes produit (non négociables)
1. **Hyper intuitif** : un agent CCAS non technophile doit pouvoir l'utiliser sans formation de plus de 30 min.
2. **Le bénévole ne voit que ce dont il a besoin** : une liste de personnes à appeler, un script, des boutons de résultat. Rien d'autre.
3. **Zéro charge supplémentaire pour les intervenants à domicile** (infirmières, aides à domicile) par défaut.
4. **Éviter les doublons** : ne jamais appeler quelqu'un qui est déjà couvert (passage d'intervenant, absence déclarée, déjà joint).
5. **Toujours un humain en bout de chaîne** : l'IA et l'automatisation assistent, mais toute situation à risque remonte à un humain.
6. **Données sensibles = sécurité et RGPD by design** (données de santé, personnes vulnérables).

### 0.4 Indicateurs de succès (proposés)
- 100 % des personnes inscrites contactées dans les X heures suivant le déclenchement d'une alerte **[À CONFIRMER : X]**.
- Taux de doublons d'appel (personne appelée alors que déjà couverte) < 2 %.
- Taux de fiches à jour (vérifiées dans les 12 derniers mois) > 90 %.
- Temps moyen de prise en main d'un bénévole < 5 min.

---

## 1. Rôles et personas

| Rôle | Qui | Ce qu'il peut faire | Ce qu'il ne peut PAS faire |
|---|---|---|---|
| **Super-admin** | Éditeur de la plateforme | Création des communes clientes (1 commune = 1 CCAS = 1 espace isolé), gestion des admins CCAS | Lire les fiches nominatives (sauf besoin support tracé) |
| **Admin CCAS** | Responsable CCAS | Tout le périmètre CCAS : valider inscriptions, gérer utilisateurs, déclencher alertes, paramétrer scoring/IA, stats complètes, exports | — |
| **Agent CCAS** | Travailleur social, agent d'accueil | Créer/modifier fiches, journal d'interactions, listes, campagnes assignées, stats | Gérer les utilisateurs, paramétrer l'IA, supprimer définitivement |
| **Bénévole** | Bénévole, agent mobilisé d'un autre service, élu | Uniquement l'**interface d'appel** : sa liste assignée, la fiche réduite, le script, la saisie du résultat | Voir la base complète, les stats, les fiches hors de sa liste, exporter |
| **Intervenant externe** (optionnel, cf. E6) | SAAD, SSIAD, infirmière libérale | Rien par défaut. Option : confirmer un passage en 1 clic via lien SMS | Tout le reste |
| **Public** | Senior, proche, voisin | Remplir le formulaire d'inscription en ligne | Tout le reste |

---

## 2. Glossaire

- **Bénéficiaire** : personne vulnérable suivie par le CCAS (60 ans et + ou en situation de handicap).
- **Foyer** : regroupement de 1 ou 2 bénéficiaires vivant à la même adresse (ex. un couple inscrit sur le même formulaire). Ils partagent adresse, intervenants et contacts, mais chacun a sa fiche et son statut d'appel.
- **PAU** : Plan Alerte et Urgence, nom local du dispositif de registre.
- **Fiche** : dossier complet d'un bénéficiaire.
- **Cercle** : ensemble des personnes et structures gravitant autour du bénéficiaire (famille, voisin, infirmière, gardienne…).
- **Interaction** : tout contact tracé (appel, visite, SMS, appel IA, passage intervenant).
- **Prise en charge** : aide dont bénéficie la personne (APA, PCH, SAAD, SSIAD, portage de repas, téléassistance…).
- **Planning de passage** : créneaux récurrents où un intervenant passe au domicile.
- **Indisponibilité** : période où la personne n'est pas joignable / pas à son domicile (vacances, hospitalisation, séjour chez un proche).
- **Liste** : sous-ensemble filtré et sauvegardé de bénéficiaires (vue tableau).
- **Campagne** : opération d'appels à mener sur une liste (ex. « Canicule juillet 2026 », « Inondation rue X »), avec assignations et statuts.
- **Alerte** : événement déclencheur (canicule, grand froid, inondation, autre) qui lance une ou plusieurs campagnes.
- **Score de priorité** : note calculée qui détermine l'ordre d'appel.
- **Couverture** : un bénéficiaire est « couvert » pour une journée s'il a eu un contact valide (appel abouti, passage d'intervenant, visite) ce jour-là.

---

## 3. Epics et user stories

### E1 — Fiche bénéficiaire

**E1-US1 (M)** — En tant qu'agent CCAS, je peux créer une fiche bénéficiaire.
Champs (voir modèle de données §4 pour le détail) :
- Identité : civilité, nom, nom de naissance, prénom, sexe, date de naissance (âge calculé automatiquement), photo (C).
- Coordonnées : adresse complète (géocodée automatiquement) structurée comme le formulaire PAU — résidence/bâtiment, entrée, n° d'appartement, rue —, étage, ascenseur (oui/non), code d'accès / digicode, téléphone fixe, mobile, email, langue parlée, préférence de contact (fixe/mobile/visite), créneaux préférés pour être appelé.
- Situation : mode de vie (vit seul(e) / en couple / avec un tiers), catégorie (60 ans et + / handicap moins de 60 ans), **mesure de protection** (non / oui + type tutelle, curatelle, sauvegarde + structure et téléphone du mandataire), type de logement (maison / appartement / logement sous les toits), logement climatisé ou pièce fraîche (oui/non), animaux.
- Autonomie & santé (données sensibles, accès restreint) : niveau GIR si connu, **mode de déplacement dans le domicile** (valeurs du formulaire PAU : seul(e) / canne / déambulateur / fauteuil roulant / immobilisé(e)), troubles auditifs, visuels, cognitifs, handicap (type, texte libre + tags), appareillage (fauteuil, déambulateur, oxygène…), téléassistance (oui/non + fournisseur), médecin traitant.
- Habitudes : texte libre + tags (ex. « sort au marché le mardi matin », « fait la sieste 14h-16h, ne pas appeler »), centres d'intérêt (pour les appels de convivialité).
- Dates clés : anniversaire, date d'inscription, date de dernière vérification de la fiche.
- Consentements : consentement inscription registre, « la personne concernée est informée » (si inscrite par un tiers), consentement appel IA, consentement partage avec intervenants, date et canal du recueil.
- Foyer : lien vers le second membre du foyer le cas échéant.
- Statut de la fiche : `en attente de validation` / `active` / `suspendue` / `archivée` (décès, déménagement, désinscription) + motif.

Critères d'acceptation :
- Les champs obligatoires sont : nom, prénom, date de naissance, adresse, au moins un téléphone OU une mention « pas de téléphone ».
- L'adresse est autocomplétée et géocodée (API Adresse BAN – adresse.data.gouv.fr) ; si le géocodage échoue, la fiche est enregistrée avec un drapeau « adresse à vérifier ».
- Détection de doublon à la création (même nom + date de naissance, ou même téléphone) avec proposition de fusion.

**E1-US2 (M)** — En tant qu'agent, je vois en haut de chaque fiche un **bandeau de synthèse** : âge, vit seul, score de priorité, prises en charge actives, indisponibilité en cours, dernier contact (date + résultat), prochain rappel, alertes actives.

**E1-US3 (M)** — En tant qu'agent, je peux modifier une fiche ; chaque modification est historisée (qui, quand, ancienne/nouvelle valeur).

**E1-US4 (M)** — En tant qu'agent, je peux archiver une fiche avec un motif (décès, déménagement, entrée en EHPAD, désinscription volontaire, autre). Une fiche archivée n'apparaît plus dans les listes ni les campagnes mais reste dans les statistiques historiques (anonymisée selon la politique de rétention, cf. E13).

**E1-US5 (S)** — En tant qu'agent, je suis alerté des fiches « non vérifiées depuis plus de 12 mois » (durée paramétrable) et je peux lancer une **campagne de mise à jour** (cf. E9, type « vérification annuelle »).

**E1-US6 (S)** — Tags libres paramétrables par l'admin (ex. « isolement social », « refuse les visites », « ancien combattant ») utilisables dans les filtres et stats.

---

### E2 — Cercle de proches (graphe)

**E2-US1 (M)** — En tant qu'agent, je peux ajouter des contacts au cercle d'un bénéficiaire.
Chaque contact : nom, prénom, type de relation / lien de parenté (enfant, conjoint, autre famille, voisin, ami, gardien(ne), infirmière, aide à domicile, médecin, tuteur/curateur, autre), structure (si professionnel), téléphone(s), email, **possède les clés** (oui/non — champ présent dans le formulaire PAU, crucial pour une intervention), **ville** (pour savoir s'il peut se déplacer rapidement), disponibilités, **rang d'appel** (ordre dans lequel le joindre si le bénéficiaire ne répond pas), est personne à prévenir en cas d'urgence (oui/non), est représentant légal (oui/non).

**E2-US2 (M)** — Un contact peut être lié à **plusieurs bénéficiaires** (ex. la même infirmière libérale ou la même gardienne pour tout un immeuble). Modifier son téléphone le met à jour partout.

**E2-US3 (S)** — En tant qu'agent, je visualise le cercle sous forme de **graphe radial** : le bénéficiaire au centre, les contacts autour, la distance au centre = rang d'appel, la couleur = type (famille / voisinage / professionnel de santé / aide à domicile / institution). Clic sur un nœud = affiche ses coordonnées et un bouton « appeler ».

**E2-US4 (M)** — Vue liste (accessibilité, mobile) : contacts triés par rang d'appel, avec pastille 🔑 si le contact possède les clés. **Le bénévole ne voit QUE cette liste** (validé) ; le graphe est réservé au CCAS.

**E2-US5 (C)** — Graphe « immeuble / quartier » : voir les bénéficiaires qui partagent un même contact (même gardienne, même infirmière) pour optimiser les tournées et les appels groupés.

---

### E3 — Journal d'interactions (appels, visites)

**E3-US1 (M)** — En tant qu'agent, je peux enregistrer une interaction : type (appel sortant, appel entrant, visite à domicile, SMS, email, courrier, appel IA, passage intervenant), date/heure, durée, auteur, interlocuteur (le bénéficiaire ou un contact du cercle), résultat (cf. RG-03 statuts), compte rendu libre, besoins détectés (tags : eau, courses, médicament, isolement, chaleur dans le logement, chute, autre), action de suivi à prévoir.

**E3-US2 (M)** — La fiche affiche une **timeline** chronologique de toutes les interactions, filtrable par type et par période, avec mise en évidence des interactions issues d'une campagne d'alerte.

**E3-US3 (M)** — Si une interaction comporte une « action de suivi », un **rappel** est automatiquement créé (cf. E4) et assigné à l'auteur ou à un collègue.

**E3-US4 (S)** — Saisie rapide : depuis la vue tableau, je peux enregistrer un appel en 2 clics (résultat + commentaire facultatif) sans ouvrir la fiche.

**E3-US5 (S)** — Modèles de compte rendu (ex. « appel de convivialité », « visite de vérification annuelle ») paramétrables par l'admin.

---

### E4 — Rappels, agenda et dates importantes

**E4-US1 (M)** — Rappels automatiques d'anniversaire : X jours avant (paramétrable, défaut J-3), le CCAS reçoit un rappel « Anniversaire de Mme Y (85 ans) le …». Les anniversaires « ronds » (80, 90, 100 ans) sont mis en évidence.

**E4-US2 (M)** — Rappels manuels : sur une fiche, je crée un rappel (date, objet, assigné à moi ou à un collègue). Ex. « rappeler après sa sortie d'hôpital le 12/11 ».

**E4-US3 (M)** — Page **« Mes tâches du jour »** (page d'accueil de l'agent) : rappels du jour, rappels en retard, anniversaires, inscriptions en attente de validation (admin), fiches à revérifier.

**E4-US4 (S)** — Fréquence de contact cible par bénéficiaire (ex. « appel de convivialité toutes les 2 semaines ») → rappel automatique si aucune interaction depuis N jours.

**E4-US5 (C)** — Notification des rappels par email quotidien récapitulatif.

---

### E5 — Indisponibilités et informations prioritaires

**E5-US1 (M)** — En tant qu'agent (ou via l'appel IA / le bénévole / le formulaire public), je peux déclarer une indisponibilité : type (vacances, hospitalisation, séjour chez un proche, séjour en établissement temporaire, autre), date de début, date de fin (ou « jusqu'à nouvel ordre »), lieu/joignabilité pendant l'absence (ex. « joignable sur le mobile de sa fille »), source de l'information.

**E5-US2 (M)** — Pendant une indisponibilité active, la personne est **automatiquement exclue des campagnes d'appel** (ou marquée « absente – ne pas appeler ») avec la raison visible. L'admin peut forcer l'inclusion.

**E5-US3 (M)** — À la date de fin, un rappel « Vérifier le retour de M. X » est créé automatiquement.

**E5-US4 (M)** — Bandeau d'**informations prioritaires** sur la fiche (texte court, coloré, toujours visible en haut, y compris pour le bénévole) : ex. « Malentendante – laisser sonner longtemps », « Ne pas appeler avant 10h », « Chien agressif en cas de visite ».

**E5-US5 (S)** — Hospitalisation : lien avec le cercle (prévenir le CCAS au retour) et marquage « retour d'hospitalisation = fragilité accrue » → bonus temporaire au score de priorité pendant 30 jours.

---

### E6 — Prises en charge et passages d'intervenants (anti-doublon)

**E6-US1 (M)** — En tant qu'agent, je renseigne les intervenants et prises en charge du bénéficiaire. Types repris du formulaire PAU : **aide à domicile, portage de repas, soins infirmiers, téléalarme, kiné, médecin traitant** ; types complémentaires : APA, PCH, SSIAD, accueil de jour, autre. Pour chacun : organisme / nom, téléphone, **possède les clés** (oui/non), date de début/fin, GIR (pour l'APA), nombre d'heures ou de visites par semaine, contact référent (lié au cercle E2).

**E6-US2 (M)** — Pour chaque prise en charge avec passages à domicile, je saisis un **planning récurrent** : jours de la semaine + créneau horaire (ex. lun-mer-ven 8h30-9h30 ; tous les jours 12h portage repas). Exceptions possibles (jours fériés, congés de l'intervenant).

**E6-US3 (M)** — **Règle anti-doublon (RG-05)** : en mode campagne d'alerte, un bénéficiaire ayant un passage d'intervenant prévu **le jour même** est affiché « Couvert par passage [SAAD X] à 9h » et **n'est pas proposé à l'appel** par défaut. Il reste visible dans le tableau (statut « couvert – passage prévu ») et l'agent peut le réintégrer en 1 clic.

**E6-US4 (M)** — Vue CCAS « **Couverture du jour** » pendant une alerte : pour chaque bénéficiaire de la campagne → couvert par passage / couvert par appel / absent / à appeler / non joint / en danger. Visible en un coup d'œil (code couleur + compteurs).

**E6-US5 (S)** — **Option « confirmation de passage » sans effort pour l'intervenant** (proposition, cf. §8.2) : pendant une alerte uniquement, la structure (SAAD/SSIAD) ou l'intervenant reçoit un SMS le matin : « Alerte canicule – vos passages du jour chez des personnes inscrites au registre : Mme X 9h, M. Y 11h. Si un passage n'a pas lieu ou si une personne vous inquiète, répondez à ce SMS ou cliquez ici. » → **par défaut, absence de réponse = passage considéré comme effectué** ; seul l'imprévu génère une action. Ainsi aucun effort n'est demandé en situation normale.

**E6-US6 (C)** — Import du planning des SAAD/SSIAD par fichier CSV (format type fourni par la plateforme) ou par API depuis leurs logiciels métier, pour éviter la double saisie.

**E6-US7 (S)** — Alerte si une prise en charge arrive à échéance (ex. fin de droits APA dans 30 jours).

---

### E7 — Inscription en ligne et validation

**E7-US1 (M)** — Formulaire public d'inscription au registre, accessible depuis le site de la mairie (lien + QR code imprimable pour les flyers / courriers), utilisable par :
- le senior lui-même,
- un proche / tiers (avec mention obligatoire « la personne a donné son accord » — le registre est à inscription volontaire),
- un agent au guichet ou au téléphone (même formulaire, côté back-office).

Contenu du formulaire : **reprise fidèle du formulaire PAU 2026**, découpé en étapes (une étape par écran sur mobile) :

1. **Qui remplit ?** Moi-même / un proche ou un tiers → si tiers : « La personne concernée est informée » (oui/non ; **non = inscription bloquée** avec message explicatif) + identité et téléphone du tiers.
2. **Personne(s) concernée(s)** : 1 ou 2 personnes du même foyer. Pour chacune : nom, prénom, date de naissance, téléphone, email.
3. **Adresse** : résidence/bâtiment, entrée, n° d'appartement, rue (autocomplétion BAN), étage, ascenseur.
4. **Situation personnelle** : vit seul(e) / en couple / avec un tiers ; personne de 60 ans et + / en situation de handicap de moins de 60 ans ; mode de déplacement dans le domicile (seul(e), canne, fauteuil roulant, déambulateur, immobilisé(e)) ; mesure de protection (non / oui + structure + téléphone).
5. **Intervenants à domicile** : services d'aide à domicile oui/non ; tableau aides à domicile / portage de repas / soins infirmiers / téléalarme / kiné / médecin traitant → nom, téléphone, possède les clés. **Ajout plateforme** : jours et heures de passage habituels (alimente l'anti-doublon E6-US3), facultatif.
6. **Personnes à prévenir en cas d'urgence** (au moins 1, jusqu'à 5) : nom, prénom, lien de parenté, téléphone, possède les clés, ville. Rappel affiché : « Il est fortement conseillé aux proches de prendre fréquemment des nouvelles des personnes inscrites lorsque le plan est déclenché. »
7. **Périodes d'absence prévues** : sélecteur de dates (crée des indisponibilités E5).
8. **Ajouts plateforme** (facultatifs) : logement sous les toits / pièce fraîche, troubles auditifs, préférence d'horaire d'appel, accord pour être appelé par un assistant automatique (IA).
9. **Consentement et validation** : mentions RGPD du formulaire actuel (responsable de traitement = CCAS de la commune, conservation 1 an, droits, contact DPO — **textes paramétrables par commune**), case d'acceptation remplaçant la signature, date et lieu automatiques.

**E7-US2 (M)** — Le formulaire calcule un **score de priorité** (cf. RG-01) à partir des réponses ; le score n'est **pas visible** par le demandeur. Pour un foyer de 2 personnes, chaque personne a son propre score.

**E7-US2 bis (M)** — Une inscription à 2 personnes crée **2 fiches liées au même foyer** (adresse, intervenants et contacts partagés).

**E7-US3 (M)** — La soumission crée une fiche au statut `en attente de validation`. L'admin (ou agent habilité) voit une file « Inscriptions à valider » triée par score ; il peut : valider (fiche → `active`), compléter puis valider, rejeter (motif), fusionner avec une fiche existante (doublon détecté).

**E7-US4 (M)** — Accusé de réception : écran de confirmation + email/SMS au demandeur (si coordonnées fournies). Notification au CCAS lors d'une nouvelle inscription.

**E7-US5 (M)** — Formulaire accessible **RGAA niveau AA**, gros caractères, une question par écran sur mobile, sauvegarde du brouillon, pas plus de ~10 minutes à remplir.

**E7-US6 (S)** — Protection anti-spam (captcha accessible type hCaptcha / Friendly Captcha, pas de reCAPTCHA image).

**E7-US7 (C, mis de côté avec E11)** — Inscription par téléphone via l'agent IA (cf. E11) : l'IA conduit l'entretien d'inscription et crée une fiche `en attente de validation`.

---

### E8 — Vue tableau, listes et travail collaboratif

**E8-US1 (M)** — Vue **tableau** de tous les bénéficiaires : colonnes configurables (afficher/masquer/réordonner), tri multi-colonnes, pagination ou scroll infini, recherche plein texte (nom, téléphone, adresse).

**E8-US2 (M)** — **Filtres combinables** sur tous les champs : âge (plage), sexe, vit seul, mobilité, handicap, prises en charge (APA oui/non, GIR), score/niveau de priorité, statut, tags, date du dernier contact, indisponibilité, **géographie** (cf. E8-US3).

**E8-US3 (M)** — **Filtres géographiques** :
- par rue (une ou plusieurs, avec autocomplétion sur les voies de la commune),
- par numéro (plage de numéros dans une rue — ex. inondation côté pair du n°2 au n°40),
- par quartier / IRIS / bureau de vote (référentiels paramétrables),
- **(S)** par sélection sur une **carte** (dessin d'un polygone ou cercle autour d'un point),
- **(C)** par superposition d'une couche de risque (zone inondable PPRI importée).

**E8-US4 (M)** — Vue **carte** des bénéficiaires (points colorés par priorité/statut) synchronisée avec les filtres du tableau.

**E8-US5 (M)** — **Enregistrer une liste** : le résultat d'un filtre peut être sauvegardé comme liste nommée — soit **dynamique** (le filtre est réévalué à chaque ouverture), soit **figée** (snapshot des personnes à l'instant T, nécessaire pour une campagne). Ex. « Inondation 28/10 – rue de la Rivière + quai Nord ».

**E8-US6 (M)** — **Assignation** : je sélectionne des lignes (une, plusieurs, toutes) et je les assigne à un ou plusieurs collègues ou bénévoles. Option « répartir automatiquement » : répartition équitable entre N personnes, en respectant l'ordre de priorité et (S) en regroupant par secteur géographique.

**E8-US7 (M)** — **Collaboratif temps réel** :
- les statuts, assignations et commentaires se mettent à jour en direct chez tous les utilisateurs connectés (sans recharger) ;
- **verrou d'appel** : quand quelqu'un ouvre une personne pour l'appeler, la ligne affiche « En cours d'appel par Julie » pour tous et ne peut pas être prise par un autre (verrou auto-libéré après 10 min d'inactivité) ;
- indicateur de présence (qui est connecté sur la liste).

**E8-US8 (M)** — Actions groupées : changer le statut, assigner, ajouter un tag, exporter (selon droits), ajouter à une campagne.

**E8-US9 (S)** — Export CSV/Excel d'une liste (admin uniquement, tracé dans le journal d'audit, cf. E13), avec choix des colonnes ; les colonnes de santé exigent une confirmation explicite.

**E8-US10 (S)** — Vues sauvegardées par utilisateur (colonnes + filtres + tri).

---

### E9 — Alertes et campagnes d'appel

**E9-US1 (M)** — En tant qu'admin, je **déclenche une alerte** : type (canicule, grand froid, inondation, tempête, pollution, épidémie, autre), niveau (ex. vigilance orange / rouge), dates de début et de fin prévues, périmètre (toute la commune ou zone géographique), message interne.

**E9-US2 (M)** — Le déclenchement d'une alerte propose de créer une **campagne** à partir :
- de tous les bénéficiaires actifs, ou
- d'une liste sauvegardée (E8-US5), ou
- d'un filtre à la volée (ex. zone inondée).

La campagne fige la liste (snapshot), applique les exclusions automatiques (indisponibles, couverts par un passage du jour — RG-05) et trie par score de priorité.

**E9-US3 (M)** — Paramètres d'une campagne : nom, script d'appel (modèle par type d'alerte, éditable — le modèle « Canicule » est livré pré-rempli avec le guide d'entretien du client, cf. E10-US4 bis), questions à poser (checklist), fréquence (un appel unique / un appel par jour pendant toute la durée de l'alerte / tous les N jours), canaux (humain, IA, mixte — cf. E11), équipe mobilisée.

**E9-US4 (M)** — **Campagne multi-jours** : pour une canicule de 5 jours, chaque jour génère une « vague » ; les statuts repartent de « à appeler » chaque jour, sauf pour les personnes couvertes ce jour-là (passage intervenant, absence).

**E9-US5 (M)** — Tableau de bord de campagne temps réel : nombre à appeler / en cours / joints RAS / joints avec besoin / non joints après N tentatives / escaladés / en danger / couverts par passage / absents ; progression par appelant ; liste des **situations à traiter en priorité** (en danger, non joints après toutes tentatives).

**E9-US6 (M)** — **Règle de relance (RG-04)** : une personne non jointe est automatiquement reprogrammée (tentative 2 après 30 min, tentative 3 après 2h — paramétrable) ; après N échecs → escalade vers le cercle (rang 1, puis 2…) ; si toujours personne → statut « **non joint – à traiter** » → l'admin décide (visite à domicile, police municipale, pompiers).

**E9-US7 (M)** — **Clôture de l'alerte** : l'admin clôture ; un **rapport de campagne** est généré (stats, liste des situations signalées, actions menées) exportable en PDF — utile pour la préfecture et le bilan municipal.

**E9-US8 (S)** — Campagnes « hors crise » avec le même mécanisme : vérification annuelle des fiches, appels de convivialité, campagne de vaccination, rappel avant l'été (« êtes-vous toujours au même numéro ? partez-vous en vacances ? »).

**E9-US9 (C)** — Déclenchement suggéré automatiquement à partir des bulletins de vigilance Météo-France (API vigilance) pour le département : notification à l'admin « Vigilance canicule orange demain – lancer une campagne ? ».

---

### E10 — Interface bénévole (mode « appel uniquement »)

> Principe : **une seule chose à faire — appeler — et rien d'autre à l'écran.** Pensée mobile-first (le bénévole peut appeler depuis son propre téléphone) et utilisable sur ordinateur.

**E10-US1 (M)** — Accès : l'admin crée un compte bénévole (nom, téléphone, email) ou envoie un **lien d'invitation** valable pour la durée de l'alerte. Connexion par lien magique (email/SMS) + code à usage unique, **sans mot de passe à retenir**. L'accès expire automatiquement à la clôture de la campagne.

**E10-US2 (M)** — Au premier lancement : un écran d'explication de 3 étapes maximum + rappel de confidentialité à accepter (engagement de confidentialité horodaté).

**E10-US3 (M)** — Écran principal = **« Ma liste »** : uniquement les personnes qui lui sont assignées, triées par priorité puis par heure de rappel, avec pour chacune : prénom + nom, âge, statut (pastille de couleur), heure de la prochaine tentative. Un gros bouton « **Personne suivante** ».

**E10-US4 (M)** — Écran « **Appel** » (une personne à la fois), contenu strictement limité à :
- nom, âge, bandeau d'informations prioritaires (E5-US4) — ex. « malentendante » ;
- bouton **Appeler** (lien `tel:` sur mobile, numéro en grand sur ordinateur) ;
- **le script** de l'appel avec les questions sous forme de cases à cocher (ex. « Buvez-vous suffisamment ? », « Avez-vous une pièce fraîche ? », « Avez-vous besoin de quelque chose ? ») ;
- **boutons de résultat** larges : ✅ Joint – tout va bien / ⚠️ Joint – a besoin de quelque chose / 📵 Ne répond pas / ☎️ Mauvais numéro / ✈️ Absent (n'est pas chez lui) / 🚨 Danger – urgence ;
- champ « Note » (facultatif, dictée vocale possible sur mobile).

**N'apparaissent PAS** : santé détaillée, historique complet, prises en charge, stats, autres bénéficiaires, export.

**E10-US4 bis (M)** — **Script « Canicule » par défaut** (repris du guide d'entretien du client, nom de l'appelant et de la commune injectés automatiquement) :

> « Bonjour Mme/M. {nom}, je suis {prénom appelant} de {structure : Maison des seniors / mairie de {commune}}. Comme vous êtes inscrit(e) sur le Plan Alerte et Urgence et qu'il a été déclenché, je me permets de vous appeler pour prendre de vos nouvelles et m'assurer que vous allez bien. Je me permets de vous poser quelques questions. »

| # | Question (case oui/non) | Si réponse préoccupante |
|---|---|---|
| Q1 | Comment allez-vous ? Pas de souci particulier (nausées, maux de tête, vertiges…) ? | Afficher le conseil : « Cessez votre activité et buvez de l'eau ; si ça persiste, consultez votre médecin. » + proposer le statut « Joint – besoin signalé » |
| Q2 | Recevez-vous de la visite ou des appels de votre famille, amis, voisins ? | Non → tag « isolement » sur la fiche |
| Q3 | Appliquez-vous les recommandations pour supporter la chaleur ? | Non → afficher l'encart des recommandations à lire |

- **Encart repliable « Recommandations chaleur »** : boire régulièrement sans attendre la soif, manger léger ; mouiller la peau (visage, cou, avant-bras) ; fermer volets et fenêtres des façades au soleil tant qu'il fait plus chaud dehors ; ouvrir tôt le matin, tard le soir et la nuit ; faire des courants d'air ; éviter de sortir aux heures chaudes ; chapeau et vêtements légers et amples.
- **Conclusion** : « N'hésitez pas à contacter {structure} si besoin. Je vous rappelle tant que le plan est activé. Bonne journée, à demain. »
- **Boutons complémentaires** : « Besoin d'une visite à domicile » (crée une demande urgente pour le CCAS) ; « Demande d'info sur des services seniors » (crée un rappel pour un agent, avec le sujet).
- **Pied d'écran** : numéro Canicule Info Service **0 800 06 66 66** (9h-19h, conseils) et numéro de la structure.
- Les scripts « Grand froid » et « Inondation » suivent la même structure (contenu proposé ci-dessous, à faire valider par le client avant production).

**E10-US4 ter (M)** — **Script « Grand froid » par défaut** (proposé, inspiré des recommandations Santé publique France) :

> « Bonjour Mme/M. {nom}, je suis {prénom appelant} de {structure}. Comme vous êtes inscrit(e) sur le Plan Alerte et Urgence et qu'il a été déclenché en raison du grand froid, je me permets de vous appeler pour prendre de vos nouvelles. »

| # | Question (case oui/non) | Si réponse préoccupante |
|---|---|---|
| Q1 | Comment allez-vous ? Pas de souci particulier (frissons, engourdissement des mains ou des pieds, toux, fièvre) ? | Conseil : « Couvrez-vous, buvez une boisson chaude ; si ça persiste, appelez votre médecin. » → « Joint – besoin signalé » |
| Q2 | Votre chauffage fonctionne-t-il et votre logement est-il assez chaud ? | Non → besoin « chauffage » + proposition « Besoin d'une visite à domicile » |
| Q3 | Recevez-vous de la visite ou des appels de votre famille, amis, voisins ? | Non → tag « isolement » |
| Q4 | Avez-vous ce qu'il faut à la maison (repas, médicaments) pour ne pas avoir à sortir ? | Non → besoin « courses » ou « médicaments » |

- **Encart « Recommandations froid »** : maintenir une température d'environ 19 °C ; ne jamais boucher les aérations et aérer 10 minutes par jour ; ne pas utiliser de chauffage d'appoint en continu ni de four ou de barbecue pour se chauffer (risque de monoxyde de carbone) ; limiter les sorties, et si on sort, couvrir la tête, les mains et le cou et porter plusieurs couches ; manger suffisamment et boire des boissons chaudes.
- **Bouton spécifique** : « Suspicion de monoxyde de carbone (maux de tête, nausées, plusieurs personnes malades) » → consigne immédiate « sortez, aérez, appelez le 18 ou le 112 » + statut « Danger – urgence ».
- **Pied d'écran** : 112, 18, 15, numéro de la structure.

**E10-US4 quater (M)** — **Script « Inondation » par défaut** (proposé) :

> « Bonjour Mme/M. {nom}, je suis {prénom appelant} de {structure}. Votre rue est concernée par l'inondation en cours, je vous appelle pour savoir comment vous allez et si vous avez besoin d'aide. »

| # | Question (case oui/non) | Si réponse préoccupante |
|---|---|---|
| Q1 | Êtes-vous en sécurité en ce moment ? | Non → statut « Danger – urgence » + consigne « appelez le 112 », alerte immédiate au CCAS |
| Q2 | L'eau est-elle entrée dans votre logement ? | Oui → consigne de mise en sécurité (encart) + proposition d'évacuation |
| Q3 | Avez-vous toujours de l'électricité, du chauffage et de l'eau potable ? | Non → besoin « logement » |
| Q4 | Pouvez-vous rester chez vous, ou avez-vous besoin d'être hébergé(e) ailleurs ? | Hébergement → statut **« Besoin d'évacuation / de relogement »** (statut spécifique inondation, cf. RG-03) |
| Q5 | Un proche peut-il venir vous aider ou vous accueillir ? | Oui → noter qui (lien vers le cercle) |

- **Encart « Consignes inondation »** : monter à l'étage si possible ; couper l'électricité et le gaz si l'eau entre ; ne pas descendre à la cave ni au sous-sol ; ne pas aller chercher sa voiture ; ne pas marcher ni rouler dans l'eau ; garder près de soi ses médicaments, papiers et téléphone chargé ; suivre les consignes des autorités (radio locale).
- **Pied d'écran** : 112, 18, numéro de la structure.

**E10-US5 (M)** — Si « Ne répond pas » : l'écran affiche immédiatement **« Qui appeler ensuite ? »** → les contacts du cercle par rang d'appel (relation + prénom + bouton appeler), avec le résultat à saisir pour chaque contact (« Le proche confirme que tout va bien » / « Le proche va passer » / « Le proche ne répond pas »).

**E10-US6 (M)** — Si « Danger – urgence » : écran d'action immédiate : rappel des numéros d'urgence (15, 18, 112, 114 pour personnes sourdes/malentendantes), le bénévole précise la situation en 1 phrase, **notification instantanée à l'admin et aux agents d'astreinte** (in-app + SMS). Le statut passe en rouge pour toute l'équipe.

**E10-US7 (M)** — Si « Joint – a besoin de quelque chose » : choix rapide du besoin (eau, courses, médicaments, visite, autre) → crée une tâche pour le CCAS.

**E10-US8 (M)** — Ergonomie : police ≥ 18px, contrastes AA, boutons ≥ 48px, 3 couleurs max, pas de menu, pas de jargon (« fiche », « campagne » invisibles pour le bénévole), fonctionnement sur un réseau faible (sauvegarde locale si coupure, synchronisation au retour).

**E10-US9 (S)** — « **Je n'ai plus de temps** » : le bénévole rend sa liste ; les personnes non traitées retournent dans le pot commun.

**E10-US10 (C)** — Appels passés via la plateforme (téléphonie VoIP / numéro masqué affichant le numéro du CCAS) pour ne pas exposer le numéro personnel du bénévole et enregistrer automatiquement la durée.

---

### E11 — Appels par agent vocal IA

> ⏸️ **MIS DE CÔTÉ (décision du 2026-10-28)** : aucune implémentation réelle (ni agent vocal, ni téléphonie, ni transcription). **Seules les interfaces sont conservées, en mock** : écrans de paramétrage, statuts, compteurs de tentatives, transcriptions et escalades sont alimentés par des données fictives statiques. Les US ci-dessous décrivent la cible et servent de référence pour dessiner ces écrans ; leur priorité réelle est **C (V2+)**.

**E11-US1 (M)** — Éligibilité : l'admin définit **les règles d'éligibilité** à l'appel IA (ex. score de priorité faible à moyen, pas de trouble cognitif ni auditif sévère, consentement IA = oui). Il peut aussi activer/désactiver l'IA fiche par fiche. **Une personne sans consentement explicite n'est jamais appelée par l'IA.**

**E11-US2 (M)** — Paramétrage par campagne (et surchargeable par fiche) :
- plages horaires d'appel (ex. 9h-12h et 15h-19h) ;
- nombre maximal de tentatives et délai entre tentatives ;
- appel des contacts du cercle si non réponse : oui/non, jusqu'à quel rang ;
- script de conversation : **le même que celui des humains** (E10-US4 bis), Q1 à Q3 + recommandations + question « Avez-vous prévu de vous absenter prochainement ? » ;
- voix, langue.

**E11-US3 (M)** — Comportement de l'IA :
- elle **s'annonce comme un assistant automatique** du CCAS de [commune] dès le début de l'appel ;
- elle déroule le script (état général, hydratation, pièce fraîche, besoins, absence prévue) avec une conversation naturelle et des phrases courtes, débit lent, répétition si nécessaire ;
- elle propose à tout moment d'être **rappelé par un humain** ;
- elle **ne donne aucun conseil médical** au-delà des recommandations officielles (messages Santé publique France canicule/grand froid).

**E11-US4 (M)** — Résultat structuré après chaque appel IA : statut (joint / non joint / messagerie / numéro invalide), durée, **transcription**, résumé, réponses aux questions du script, besoins détectés, absence déclarée (crée une indisponibilité E5 en attente de confirmation), **niveau de risque évalué** (vert / orange / rouge) avec justification.

**E11-US5 (M)** — **Escalade (RG-06)** — l'appel IA bascule en « **à rappeler par un humain** » (alerte visible en tête du tableau de campagne) si :
- la personne exprime un malaise, une chute, une détresse, de la confusion, une demande d'aide, ou demande un humain ;
- l'IA n'a pas compris / la conversation n'a pas pu aller au bout ;
- non joint après toutes les tentatives (et cercle non joint ou non configuré) ;
- tout doute (biais de sécurité : en cas d'incertitude, on escalade).
En cas de **danger immédiat exprimé** (« je suis tombé », « j'ai mal à la poitrine »), l'IA indique d'appeler le 15/112, et une alerte rouge immédiate est envoyée au CCAS (SMS + in-app).

**E11-US6 (M)** — Suivi visible sur la fiche et dans le tableau : nombre de tentatives faites / prévues, statut du dernier appel, prochaine tentative programmée, lien vers la **transcription**. **Pas d'enregistrement audio conservé** (décision validée) : seuls la transcription, le résumé et les réponses structurées sont stockés.

**E11-US7 (S)** — Mode mixte : l'IA fait un premier passage sur les personnes éligibles ; les humains se concentrent sur les priorités hautes et les escalades IA.

**E11-US8 (C)** — Appels IA hors crise : appels de convivialité réguliers, vérification annuelle des fiches (« êtes-vous toujours au même numéro ? »), inscription par téléphone (E7-US7).

---

### E12 — Statistiques et tableaux de bord

**E12-US1 (M)** — **Explorateur de statistiques** (« constructeur de requêtes » simple) :
- je choisis **quoi compter** : bénéficiaires, interactions, appels de campagne, inscriptions ;
- j'ajoute des **filtres** en langage naturel guidé (listes déroulantes) : `Sexe = Homme` ET `Âge ≥ 80` ET `Prise en charge = APA` ET `Mobilité = forte difficulté` → résultat : **un nombre**, puis la liste des personnes correspondantes (selon droits) ;
- je choisis un **découpage** (par tranche d'âge, sexe, quartier, GIR, niveau de priorité, mois…) → tableau croisé + graphique adapté (barres, camembert limité à 5 catégories, courbe dans le temps, carte) ;
- j'enregistre la requête pour la réutiliser.

**E12-US2 (S)** — **Recherche en langage naturel** (assistée par IA) : je tape « combien d'hommes de plus de 80 ans touchent l'APA et ont un gros problème de mobilité ? » → la plateforme traduit en filtres **affichés et modifiables** (jamais de réponse « boîte noire »), puis exécute.

**E12-US3 (M)** — **Dashboards** : je compose un tableau de bord à partir de widgets (chiffre clé, graphique, carte, tableau) alimentés par des requêtes sauvegardées ; disposition par glisser-déposer ; plusieurs dashboards nommés ; partage avec les autres agents.

**E12-US4 (M)** — Dashboards prédéfinis livrés par défaut :
1. **Population suivie** : nombre de bénéficiaires actifs, répartition âge/sexe, vit seul, mobilité, GIR, prises en charge, carte de densité par quartier, évolution des inscriptions.
2. **Activité annuelle** : interactions par mois et par type, personnes non contactées depuis > N mois, rappels traités / en retard, anniversaires.
3. **Campagne / alerte** : appelés / non appelés / joints / non joints / escaladés / en danger / couverts par passage, carte des statuts (« où ils sont »), délai moyen avant premier contact, répartition humain vs IA, performance par appelant, besoins détectés.
4. **Qualité des données** : fiches incomplètes, numéros invalides, fiches non vérifiées depuis 12 mois, adresses non géocodées.

**E12-US5 (M)** — Filtre temporel global (période) et comparaison entre périodes / entre deux alertes (ex. canicule 2025 vs 2026).

**E12-US6 (S)** — Export des graphiques (PNG) et des tableaux (CSV/Excel), export PDF d'un dashboard (rapport au conseil d'administration du CCAS, à la préfecture).

**E12-US7 (M)** — **Secret statistique** : pour les utilisateurs sans droit nominatif, les résultats < 5 personnes sont masqués (« < 5 ») pour éviter la ré-identification.

---

### E13 — Administration, sécurité, RGPD, audit

**E13-US1 (M)** — Gestion des utilisateurs et des rôles (§1), invitation par email, désactivation, réinitialisation. Authentification forte (MFA) obligatoire pour admins et agents.

**E13-US2 (M)** — **Journal d'audit** non modifiable : consultation de fiche (qui a vu quoi), modification, export, connexion, déclenchement d'alerte, accès aux données de santé. Consultable par l'admin.

**E13-US3 (M)** — **Cloisonnement des données** : chaque CCAS ne voit que ses données (multi-tenant) ; les champs de santé sont un niveau d'accès distinct.

**E13-US4 (M)** — **Droits RGPD** : export de toutes les données d'une personne (droit d'accès), rectification, suppression (droit à l'effacement / désinscription du registre), registre des traitements pré-rempli fourni au DPO de la mairie, mentions d'information affichées sur le formulaire public.

**E13-US5 (M)** — **Politique de rétention** paramétrable : ex. fiches archivées anonymisées après N mois ; enregistrements audio IA supprimés après N jours ; transcriptions conservées N mois. **[À CONFIRMER avec le DPO]**

**E13-US6 (M)** — Paramétrage : grille de score de priorité (RG-01), scripts d'appel par type d'alerte, statuts personnalisés, tags, référentiels (quartiers, structures SAAD/SSIAD), délais de relance, règles d'éligibilité IA, modèles de messages SMS/email.

**E13-US8 (M)** — **Multi-communes** : la plateforme sert plusieurs mairies ; **1 commune = 1 CCAS = 1 espace totalement isolé** (données, utilisateurs, paramétrage, textes RGPD, logo, nom de la structure — ex. « Maison des seniors de Lomme »). Pas de partage de données entre communes.

**E13-US7 (M)** — Transmission au préfet : export du registre au format demandé par la préfecture lors du déclenchement du plan d'alerte (obligation légale du registre).

---

### E14 — Notifications

**E14-US1 (M)** — Centre de notifications in-app (cloche) : nouvelle inscription, assignation, escalade, danger, rappel.
**E14-US2 (M)** — SMS / email pour les événements critiques uniquement : « danger », « escalade IA », « campagne lancée, votre liste est prête » (bénévoles).
**E14-US3 (S)** — Préférences de notification par utilisateur ; astreinte (qui reçoit les alertes rouges la nuit / le week-end).

---

### E15 — Import de données existantes (Excel)

**E15-US1 (M)** — En tant qu'admin, j'importe un fichier Excel/CSV existant. Le format n'étant pas connu, l'import est **guidé** :
1. dépôt du fichier, choix de l'onglet et de la ligne d'en-tête ;
2. **mise en correspondance des colonnes** avec les champs de la plateforme (suggestion automatique par nom de colonne, ex. « Tél » → téléphone, « DDN » → date de naissance), colonnes ignorables ;
3. correspondance des valeurs pour les listes (ex. « fauteuil », « FR » → Fauteuil roulant) ;
4. **aperçu** avec erreurs ligne par ligne (date invalide, téléphone mal formé, doublon) ;
5. import des lignes valides en statut `active` (ou `en attente de validation`, au choix), rapport téléchargeable des lignes rejetées.

**E15-US2 (S)** — Le mapping est sauvegardé pour réimporter un fichier de même format.

**E15-US3 (S)** — Gestion des colonnes « fourre-tout » : une colonne non mappée peut être importée comme note sur la fiche.

---

## 4. Modèle de données (conceptuel)

```
Commune / Ccas (tenant) ── 1..n ── Utilisateur (rôle)
     │
     ├── 1..n ── Foyer (adresse) ── 1..2 ── Beneficiaire
     │              ├── 0..n ── LienCercle ── n..1 ── Contact (partageable entre bénéficiaires)
     │              ├── 0..n ── PriseEnCharge ── 0..n ── CreneauPassage (récurrence + exceptions)
     │              │                 └── n..1 ── Structure (SAAD, SSIAD, cabinet infirmier…)
     │              ├── 0..n ── Indisponibilite
     │              ├── 0..n ── Interaction (dont AppelIA : transcription, résumé, risque)
     │              ├── 0..n ── Rappel
     │              ├── 0..n ── Consentement (type, valeur, date, canal, preuve)
     │              └── 0..n ── HistoriqueModification
     │
     ├── 0..n ── Inscription (formulaire public brut → crée Beneficiaire en attente)
     ├── 0..n ── Liste (dynamique = filtre ; figée = ensemble d'IDs)
     ├── 0..n ── Alerte ── 1..n ── Campagne ── 1..n ── Vague (jour)
     │                                  └── 1..n ── CibleCampagne (bénéficiaire, assigné à, statut, tentatives, verrou)
     ├── 0..n ── RequeteStat ── 0..n ── WidgetDashboard ── n..1 ── Dashboard
     ├── 0..n ── ParametreScore, ScriptAppel, Tag, Referentiel (quartiers…)
     └── JournalAudit
```

Champs clés de **CibleCampagne** : `beneficiaire_id`, `campagne_id`, `vague_date`, `assigne_a`, `canal` (humain/IA), `statut` (RG-03), `nb_tentatives`, `prochaine_tentative_at`, `verrou_par`, `verrou_at`, `couverture` (passage/absence/appel), `niveau_risque`, `besoins[]`, `note`.

---

## 5. Règles de gestion

**RG-01 — Score de priorité (0-100)** — calculé automatiquement, recalculé à chaque modification de fiche, pondérations paramétrables par l'admin. Grille par défaut proposée :

| Critère | Points |
|---|---|
| Vit seul | +20 |
| Âge ≥ 85 ans / 75-84 ans | +15 / +8 |
| Déplacement dans le domicile : immobilisé(e) / fauteuil roulant / déambulateur / canne | +20 / +15 / +10 / +5 |
| Mesure de protection | +5 |
| Contact d'urgence ou intervenant possédant les clés : aucun | +5 |
| Troubles cognitifs | +15 |
| Aucun contact du cercle joignable / aucun proche à proximité | +15 |
| Logement sous les toits ou sans pièce fraîche (pour canicule) | +10 |
| Aucune prise en charge à domicile (personne « invisible ») | +10 |
| Retour d'hospitalisation < 30 jours | +10 |
| Pas de téléphone | +10 (→ visite nécessaire) |

Niveaux : **P1** ≥ 60 (appel humain prioritaire, éventuellement visite), **P2** 30-59, **P3** < 30. Le score peut dépendre du **type d'alerte** (le logement sous les toits compte en canicule, pas en inondation ; le rez-de-chaussée compte en inondation). L'agent peut **forcer manuellement** un niveau avec justification.

**RG-02 — Ordre d'appel en campagne** : P1 avant P2 avant P3 ; à niveau égal, score décroissant ; puis personnes non jointes la veille en premier.

**RG-03 — Statuts d'une cible de campagne** :
`À appeler` → `En cours` (verrouillé) → l'un de :
`Joint – RAS` · `Joint – besoin signalé` · `Non joint (tentative n/N)` · `Messagerie` · `Numéro invalide` · `Absent du domicile` · `Couvert par un proche` (joint via cercle) · `Couvert par passage intervenant` · `Escaladé – à rappeler par un humain` · `Non joint – à traiter` · `Danger – urgence` · `Besoin d'évacuation / de relogement` (campagnes inondation uniquement).
Statuts « terminaux » pour la vague du jour : Joint – RAS, Couvert…, Absent. Statuts « ouverts » nécessitant une action : tous les autres.

**RG-04 — Relances** : délais et nombre de tentatives paramétrables (défaut : 3 tentatives, +30 min, +2h). Après la dernière tentative : escalade cercle (si activé), puis `Non joint – à traiter`. Pas d'appel en dehors des plages horaires autorisées (défaut 9h-19h **[À CONFIRMER]**).

**RG-05 — Anti-doublon** : un bénéficiaire est exclu de la vague du jour s'il a (a) un passage d'intervenant prévu ce jour, (b) une indisponibilité active, ou (c) déjà un statut terminal ce jour. Toujours visible avec le motif, réintégrable manuellement. Une même personne ne peut pas être assignée à deux appelants simultanément (verrou).

**RG-06 — Escalade IA** : cf. E11-US5. Toute escalade crée une notification et place la cible en tête de liste.

**RG-07 — Minimisation** : le bénévole n'accède qu'aux champs listés en E10-US4/US5, uniquement pour les personnes assignées, uniquement pendant la campagne.

**RG-08 — Âge** : toujours calculé depuis la date de naissance (jamais saisi).

---

## 6. Exigences non fonctionnelles

| ID | Exigence |
|---|---|
| NF-01 | **Hébergement certifié HDS** (Hébergeur de Données de Santé) en France pour la mise en production. Non requis pour le POC (données fictives uniquement). |
| NF-02 | Conformité RGPD : AIPD (analyse d'impact) à réaliser avant mise en production ; base légale = mission d'intérêt public (registre L121-6-1 CASF) + consentement de la personne ; DPO de la mairie associé. |
| NF-03 | Chiffrement en transit (TLS 1.2+) et au repos ; champs santé chiffrés applicativement. |
| NF-04 | Accessibilité **RGAA AA** (obligation pour les services publics) sur le formulaire public et l'interface bénévole a minima. |
| NF-05 | Responsive : interface CCAS optimisée ordinateur, utilisable tablette ; interface bénévole et formulaire public **mobile-first**. |
| NF-06 | Performance : tableau de 10 000 bénéficiaires filtré en < 1 s ; mise à jour temps réel entre utilisateurs < 2 s. |
| NF-07 | Disponibilité renforcée pendant les alertes (99,9 %) ; sauvegardes quotidiennes, PRA documenté ; **export de secours** (PDF/CSV de la liste de campagne) pour continuer sur papier en cas de panne. |
| NF-08 | Montée en charge : 50 utilisateurs simultanés par CCAS en période de crise **[À CONFIRMER]**. |
| NF-09 | Interface entièrement en français ; agent IA multilingue en option (C). |
| NF-10 | Traçabilité complète (E13-US2), horodatage serveur. |
| NF-11 | Agent vocal IA : fournisseur hébergé dans l'UE, pas d'utilisation des données pour l'entraînement, enregistrement soumis à consentement. |

---

## 7. Découpage en lots (proposition)

**Lot 1 — MVP « registre vivant » (toute l'année)**
E1 (US1-4), E2 (US1, 2, 4), E3 (US1-3), E4 (US1-3), E5 (US1-4), E6 (US1-2), E7 (US1-5), E8 (US1-3, 5-8), E13 (US1-5, 7), E14 (US1).

**Lot 2 — « Mode crise »**
E6 (US3-4), E8 (US4 carte), E9 (US1-7), E10 (complet M), E12 (US1, 3, 4, 5, 7), E14 (US2).

**Lot 3 — « IA et confort »**
E11 (complet — **mis de côté**, seules ses maquettes sont dans le POC), E12-US2 (stats en langage naturel), E2-US3 (graphe), E6-US5 (SMS intervenants), E9-US8/9, E1-US5/6.

**Lot 4 — Intégrations**
E6-US6 (import plannings SAAD/SSIAD), E8-US3 couche PPRI, E10-US10 (téléphonie VoIP), E11-US8.

> Recommandation PO : le lot 2 doit être prêt **avant juin** (saison canicule). Le lot 3 (IA) ne doit pas bloquer la mise en service.

---

## 8. Propositions d'ajouts (au-delà du besoin exprimé)

1. **Mode « visite à domicile »** pour les P1 sans téléphone ou non joints : génération d'une **tournée** optimisée (ordre de passage sur carte) pour la police municipale / agents de terrain, avec saisie du résultat sur mobile.
2. **Couverture intervenants « sans effort »** (réponse à la question CFAM) : le planning de passage est saisi **une fois** par le CCAS à partir du plan d'aide APA / de la structure (ou importé, lot 4). Pendant une alerte seulement, un **SMS d'exception** est envoyé aux structures : on ne demande rien si tout se passe normalement, on ne remonte que l'imprévu (passage annulé, personne inquiétante). Charge pour l'infirmière = zéro dans 95 % des cas.
3. **Campagne pré-saison** automatique en mai : « Êtes-vous toujours au même numéro ? Partez-vous cet été ? » (par l'IA ou par SMS) → fiches à jour avant la première canicule.
4. **Rapport préfecture en 1 clic** à la clôture d'une alerte.
5. **Courrier / SMS d'anniversaire** automatisable (carte du maire) — levier de lien social et de recrutement au registre.
6. **Détection d'isolement** : alerte « aucune interaction depuis 3 mois et aucun proche dans le cercle » → proposer des appels de convivialité réguliers / mise en relation avec des associations (Petits Frères des Pauvres, Monalisa).
7. **Bénévoles « réservistes »** : vivier de bénévoles préinscrits avec disponibilités, mobilisables en 1 clic par SMS quand l'alerte est déclenchée.
8. **Mode dégradé papier** : impression de la liste d'appel + fiche réduite, puis ressaisie rapide.
9. **Lien téléassistance** : si la personne a une téléassistance, afficher le fournisseur pour coordonner (ils appellent parfois aussi leurs abonnés en canicule → autre source de doublon).
10. **Multi-communes / intercommunalité (CIAS)** : architecture multi-tenant dès le départ pour vendre la solution à plusieurs CCAS.

---

## 9. Hors périmètre (pour l'instant)

- Dossier médical ou suivi de soins (on n'est pas un logiciel de soins).
- Gestion financière des aides (instruction APA = Département).
- Application mobile native (le web responsive suffit, PWA éventuelle).
- Messagerie avec les familles.

---

## 10. Périmètre du POC visuel

### 10.1 Objectif
Démontrer à des mairies / CCAS, en **10 à 15 minutes de démo**, que l'outil est intuitif et qu'il règle les vrais problèmes (données à jour, doublons, bénévoles, pilotage). Le POC est **une vraie application interactive** : on crée, modifie, filtre, assigne et appelle pour de vrai, et tout est **persisté en base PostgreSQL**. Seules les **intégrations externes** (téléphonie, SMS, IA, Météo-France) sont simulées.

### 10.2 Ce qui est réel vs simulé

| Élément | Dans le POC |
|---|---|
| Navigation, écrans, interactions, filtres, tri, vues sauvegardées | **Réel** (fonctionne dans le navigateur) |
| Données | **Personnes fictives, adresses réelles** : ~150 bénéficiaires (≈ 120 foyers) répartis sur les **vraies rues de Lomme (59160)**, issues de la Base Adresse Nationale (adresse + coordonnées GPS) ; cercles, intervenants, plannings, historique d'appels sur 12 mois, 1 canicule passée (été 2026). Les noms et téléphones sont générés (numéros fictifs de la plage réservée 01 99 00 xx xx / 06 39 98 xx xx de l'ARCEP). |
| Persistance | **PostgreSQL réel** : toutes les actions sont enregistrées. Script de *seed* rejouable + bouton « Réinitialiser la démo » (admin) qui recharge le jeu de données. |
| Rôles | **Sélecteur d'utilisateur** en haut d'écran (Admin, 2 Agents, 3 Bénévoles pré-créés) au lieu d'une vraie authentification ; l'utilisateur courant est stocké en cookie, et les droits par rôle sont réellement appliqués côté serveur. |
| Temps réel collaboratif | **Réel entre plusieurs navigateurs** (rafraîchissement par polling court ou Server-Sent Events) : verrous d'appel, statuts, assignations. Pour une démo à un seul poste : ouvrir l'admin et le bénévole dans 2 fenêtres côte à côte. |
| Appels IA | **Mock d'interface uniquement** (partie mise de côté) : écran de paramétrage non fonctionnel, colonne « canal IA » et statuts IA affichés à partir de données fictives figées, 2-3 transcriptions/résumés pré-écrits, 1 escalade « danger » présente dans les données. Aucun appel, aucune logique de relance. |
| SMS, emails, téléphonie | Simulés (toast « SMS envoyé à… ») |
| Géocodage / carte | **Réels** : coordonnées pré-calculées dans le seed depuis la BAN ; autocomplétion d'adresse via l'API Adresse (gratuite, sans clé) à la création de fiche ; fond de carte OpenStreetMap |
| Déclenchement d'alerte | Manuel (bouton admin) ; pas de connexion Météo-France |
| Stats en langage naturel (E12-US2) | Facultatif : quelques questions pré-câblées |
| Import Excel | Réel sur un fichier d'exemple fourni, avec l'écran de mapping |
| RGPD, audit, MFA, HDS | Hors POC (mentionnés dans le discours, pas implémentés) |

### 10.3 Écrans du POC (ordre de priorité)
1. **Accueil agent « Mes tâches du jour »** (E4-US3).
2. **Tableau des bénéficiaires** + filtres (dont rue/numéros) + vue carte + création de liste + assignation (E8).
3. **Fiche bénéficiaire** : bandeau de synthèse, onglets Infos / Cercle (graphe + liste) / Intervenants et planning / Indisponibilités / Historique (E1, E2, E3, E5, E6).
4. **Déclenchement d'alerte → campagne** + **tableau de bord de campagne** avec « Couverture du jour » (E9, E6-US4).
5. **Interface bénévole mobile** avec le script canicule réel (E10).
6. **Appels IA — maquettes statiques** (E11, mis de côté) : réglages IA sur la fiche et la campagne, badge « IA » dans le tableau de campagne, détail d'un appel IA (transcription et résumé fictifs). Écrans non connectés, pour montrer la vision.
7. **Statistiques** : explorateur avec l'exemple « hommes de + de 80 ans, APA, forte difficulté de mobilité » + 2 dashboards prédéfinis (E12).
8. **Formulaire public d'inscription** (E7) + file de validation admin.
9. **Import Excel** (E15) — si le temps le permet.

### 10.4 Scénario de démo (fil rouge)
1. *Toute l'année* — L'agent ouvre sa journée : 2 anniversaires, un retour d'hospitalisation à vérifier, 3 inscriptions en ligne à valider → il en valide une (score P1 calculé automatiquement).
2. *Statistiques* — « Combien d'hommes de plus de 80 ans touchent l'APA et ont une forte difficulté de mobilité ? » → réponse en 3 clics + graphique.
3. *Crise* — Vigilance canicule rouge : l'admin déclenche l'alerte ; la campagne exclut automatiquement 12 personnes couvertes par un passage d'aide à domicile et 4 en vacances ; il répartit le reste entre 3 bénévoles.
4. *Bénévole* — Sur mobile : appel de Mme X → script → « tout va bien ». M. Y ne répond pas → appel de sa fille (rang 1) en 1 clic.
5. *Vision IA (mock)* — On montre une ligne « Escaladé par l'IA » déjà présente dans les données (« la personne dit avoir des vertiges ») et l'écran de transcription ; on présente l'IA comme une évolution à venir.
6. *Événement localisé* — Inondation : filtre sur une vraie rue de Lomme (plage de numéros) ou sélection sur la carte → nouvelle liste → campagne « Inondation » avec son script → assignation à 2 collègues.
7. *Bilan* — Dashboard de campagne : appelés / non appelés / carte des statuts → export du rapport.

### 10.5 Stack technique du POC

| Besoin | Choix |
|---|---|
| Framework | **Next.js (App Router) + TypeScript** (validé) |
| Base de données | **PostgreSQL** (validé), lancé en local via Docker Compose |
| Accès aux données | ORM typé : Prisma ou Drizzle (proposition : **Drizzle**, plus proche du SQL pour l'explorateur de stats) |
| UI | Tailwind CSS + shadcn/ui (composants accessibles) |
| Tableau | TanStack Table (tri, filtres, sélection multiple, colonnes configurables) |
| Carte | Leaflet + OpenStreetMap (sélection par polygone/cercle via leaflet-draw ou équivalent) |
| Graphe du cercle | SVG radial maison ou React Flow |
| Graphiques / dashboards | Recharts ; grille de widgets avec react-grid-layout |
| Import Excel | SheetJS (lecture xlsx/csv côté navigateur, puis envoi des lignes mappées au serveur) |
| Temps réel | Polling court (2-3 s) via React Query, ou SSE ; LISTEN/NOTIFY de Postgres si besoin |
| Données de démo | Script de seed TypeScript : adresses de Lomme extraites de la BAN (fichier CSV du département 59 filtré sur le code postal 59160), identités générées (Faker, locale fr) |

### 10.6 Commune de démo
- **Lomme (59160)** : vraies rues, adresses et coordonnées issues de la BAN, avec des habitants entièrement fictifs.
- Point d'attention : Lomme est une commune associée à Lille ; dans la BAN, ses adresses peuvent être rattachées à Lille (code INSEE 59350). Le filtre du seed se fera sur le **code postal 59160** (à vérifier lors de l'extraction).
- Le nom de la structure affiché est « Maison des seniors de Lomme » (paramétrable, cf. E13-US8), ce qui permet de rejouer la démo pour une autre commune en changeant le seed.
