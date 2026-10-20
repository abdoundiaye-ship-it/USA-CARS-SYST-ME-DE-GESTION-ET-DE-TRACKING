# Notifications au client — textes validés (décision E5-a, 20/10/2026)

Envoi sur **les deux canaux** (e-mail via Brevo, WhatsApp via Twilio) dès qu’ils sont renseignés sur la fiche client (R16). Les messages WhatsApp utilisent des **modèles approuvés par Meta** : les variables sont notées `{{1}}`, `{{2}}`… dans l’ordre de la colonne « Variables ».

Règles communes :

- **Aucune coordonnée de paiement** dans un message (CLAUDE.md règle 7) : le client est renvoyé vers son espace ou vers le numéro officiel.
- Montants : USD qui fait foi, FCFA indicatif (« au taux du JJ/MM/AAAA »). Dates `JJ/MM/AAAA`, heure de Dakar.
- ETA toujours « indicative » tant que l’ATA n’est pas connue ; jamais de langage de position en temps réel.
- Signature : « USA CARS — Dakar ». Lien vers l’espace client : `{{lien}}` (connexion par lien à usage unique, 15 minutes).
- Catégorie WhatsApp : « Utilitaire » (transactionnel), sauf la connexion (« Authentification »).

| Code | Déclencheur | Variables (ordre WhatsApp) |
|---|---|---|
| `login_link` | Demande de connexion / invitation | prénom ou nom, lien |
| `lot_won` | Lot remporté enregistré | nom, réf. dossier, véhicule, échéance du paiement 1 |
| `quote_issued` | Devis émis (fichier généré) | nom, réf. dossier, n° devis, total USD, validité |
| `payment_due_reminder` | Rappel J-7, J-3, J-2 avant une échéance non réglée | nom, réf. dossier, échéance (paiement 1 / solde), montant USD restant, date |
| `vessel_departed` | Départ du navire enregistré | nom, réf. dossier, conteneur, ETA indicative |
| `eta_changed` | ETA indicative modifiée | nom, réf. dossier, ancienne ETA, nouvelle ETA |
| `arrived` | ATA saisie (arrivée à Dakar) | nom, réf. dossier, date d’arrivée |
| `documents_ready` | Paiement intégral : documents à remettre | nom, réf. dossier |
| `payment_overdue` | Relance : échéance dépassée et non réglée | nom, réf. dossier, échéance, montant USD restant |

## Textes

### `login_link` — connexion à l’espace client
- **E-mail — objet :** Votre accès à l’espace client USA CARS
- **Texte :** Bonjour {{1}}, voici votre lien personnel pour accéder à votre espace USA CARS : {{2}}. Il est valable 15 minutes et ne peut servir qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.

### `lot_won` — lot remporté
- **Objet :** Lot remporté — dossier {{2}}
- **Texte :** Bonjour {{1}}, bonne nouvelle : le véhicule {{3}} (dossier {{2}}) a été remporté. Votre devis vous sera transmis sous peu ; le paiement 1 est attendu au plus tard le {{4}}. Retrouvez le détail dans votre espace : {{lien}}. USA CARS — Dakar.

### `quote_issued` — devis émis
- **Objet :** Votre devis {{3}} — dossier {{2}}
- **Texte :** Bonjour {{1}}, votre devis {{3}} pour le dossier {{2}} est disponible : {{4}} (hors assurance). Il est valable jusqu’au {{5}}. Vous pouvez l’accepter dans votre espace, en indiquant votre choix pour l’assurance transport : {{lien}}. USA CARS — Dakar.

### `payment_due_reminder` — rappel d’échéance (J-7, J-3, J-2)
- **Objet :** Rappel : {{3}} — dossier {{2}}
- **Texte :** Bonjour {{1}}, pour le dossier {{2}}, le {{3}} de {{4}} est attendu au plus tard le {{5}}. Les comptes de paiement officiels figurent dans votre espace : {{lien}}. USA CARS ne communique jamais de changement de compte par message ; en cas de doute, appelez le numéro officiel. USA CARS — Dakar.

### `vessel_departed` — départ du navire
- **Objet :** Votre véhicule est en route — dossier {{2}}
- **Texte :** Bonjour {{1}}, le conteneur {{3}} de votre dossier {{2}} a quitté le port de départ. Arrivée à Dakar prévue le {{4}} (date indicative communiquée par le transporteur). Suivi : {{lien}}. USA CARS — Dakar.

### `eta_changed` — ETA modifiée
- **Objet :** Date d’arrivée mise à jour — dossier {{2}}
- **Texte :** Bonjour {{1}}, le transporteur a modifié la date d’arrivée prévue pour votre dossier {{2}} : {{4}} au lieu du {{3}} (date indicative). Détail : {{lien}}. USA CARS — Dakar.

### `arrived` — arrivée à Dakar
- **Objet :** Votre véhicule est arrivé à Dakar — dossier {{2}}
- **Texte :** Bonjour {{1}}, le navire transportant votre véhicule (dossier {{2}}) est arrivé à Dakar le {{3}}. Nous vous contactons pour la suite : règlement du solde le cas échéant, remise des documents et enlèvement. Détail : {{lien}}. USA CARS — Dakar.

### `documents_ready` — documents prêts
- **Objet :** Vos documents sont prêts — dossier {{2}}
- **Texte :** Bonjour {{1}}, votre paiement est complet pour le dossier {{2}} : les documents du véhicule (B/L, titre, factures) sont prêts à vous être remis, à vous ou à votre mandataire muni d’une procuration et d’une pièce d’identité. Contactez-nous pour fixer le rendez-vous. USA CARS — Dakar.

### `payment_overdue` — relance
- **Objet :** Échéance dépassée — dossier {{2}}
- **Texte :** Bonjour {{1}}, sauf erreur de notre part, le {{3}} du dossier {{2}} n’est pas encore réglé (reste dû : {{4}}). Merci de régulariser au plus vite pour éviter des frais de retard, conformément au contrat. Détail et comptes officiels : {{lien}}. USA CARS — Dakar.
