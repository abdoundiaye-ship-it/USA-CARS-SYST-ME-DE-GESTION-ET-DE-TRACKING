import { SCREEN_ROLES, type AppRole } from "@/lib/auth/roles";
import type { DossierStage } from "@/lib/supabase/database.types";

/**
 * Guide « Rôles et droits d'accès » (décision P6-5) : documentation de gouvernance pour l'administrateur et la
 * direction. Les droits sont construits à partir de SCREEN_ROLES (les droits que l'application applique) : un droit
 * modifié dans le code change le guide, et les tests (roles-guide.test.ts) échouent si un droit n'est pas documenté.
 * La base (RLS et fonctions) reste la garantie réelle ; l'interface et ce guide la reflètent.
 */

/** Date de la dernière mise à jour du contenu rédigé (affichée et imprimée). */
export const GUIDE_UPDATED_AT = "2026-10-26";

export const GUIDE_ROLES = ["admin", "management", "accounting", "ops", "client"] as const satisfies readonly AppRole[];

export type Right = "consult" | "create" | "update" | "validate" | "delete";

export const RIGHTS: readonly Right[] = ["consult", "create", "update", "validate", "delete"];

export const RIGHT_LABELS: Record<Right, string> = {
  consult: "Consulter",
  create: "Créer",
  update: "Modifier",
  validate: "Valider",
  delete: "Supprimer",
};

export const RIGHT_CODES: Record<Right, string> = {
  consult: "L",
  create: "C",
  update: "M",
  validate: "V",
  delete: "S",
};

export type ScreenKey = keyof typeof SCREEN_ROLES;

/** Rôles autorisés pour un droit, et les droits d'écran (SCREEN_ROLES) dont ils proviennent. */
export interface Grant {
  roles: readonly AppRole[];
  sources: readonly ScreenKey[];
}

const ROLE_SET: ReadonlySet<string> = new Set<string>(GUIDE_ROLES);

/** Droit composé de droits d'écran (ex. « operationsWrite ») et de rôles nommés (ex. « client »). */
function grant(...parts: (ScreenKey | AppRole)[]): Grant {
  const roles = new Set<AppRole>();
  const sources: ScreenKey[] = [];
  for (const part of parts) {
    if (ROLE_SET.has(part)) {
      roles.add(part as AppRole);
    } else {
      sources.push(part as ScreenKey);
      for (const role of SCREEN_ROLES[part as ScreenKey]) roles.add(role);
    }
  }
  return { roles: GUIDE_ROLES.filter((r) => roles.has(r)), sources };
}

export type ModuleArea = "Pilotage" | "Clients et dossiers" | "Finances" | "Administration";

export interface GuideModule {
  id: string;
  area: ModuleArea;
  name: string;
  rights: Partial<Record<Right, Grant>>;
  /** Précisions : ce que recouvre chaque droit, restrictions et limites. */
  notes: string[];
}

export const MODULES: GuideModule[] = [
  // ---------------------------------------------------------------- Pilotage
  {
    id: "dashboard",
    area: "Pilotage",
    name: "Tableau de bord et recherche",
    rights: { consult: grant("dashboard") },
    notes: [
      "Chaque rôle y voit les actions à traiter qui le concernent ; la recherche ne montre que ce que le rôle peut lire.",
    ],
  },
  {
    id: "reports",
    area: "Pilotage",
    name: "Rapports et exports Excel",
    rights: { consult: grant("reports") },
    notes: [
      "Chaque rapport a ses propres droits, vérifiés par la base (voir « Rapports par rôle »).",
      "La marge par véhicule, la conservation des données et la revue des accès sont réservées à l’administrateur et à la direction.",
      "Chaque export est journalisé.",
    ],
  },
  // ---------------------------------------------------------------- Clients et dossiers
  {
    id: "clients",
    area: "Clients et dossiers",
    name: "Clients",
    rights: { consult: grant("clients", "client"), create: grant("operationsWrite"), update: grant("operationsWrite") },
    notes: [
      "Le client ne voit que sa propre fiche.",
      "Une fiche client ne se supprime pas ; son identité est effacée par l’anonymisation, à l’échéance de conservation.",
    ],
  },
  {
    id: "portal",
    area: "Clients et dossiers",
    name: "Accès du client au portail",
    rights: { create: grant("operationsWrite") },
    notes: [
      "L’équipe envoie au client un lien de connexion à usage unique (e-mail ou WhatsApp), depuis la fiche client.",
      "Un compte client n’est jamais créé depuis l’écran Utilisateurs.",
    ],
  },
  {
    id: "dossiers",
    area: "Clients et dossiers",
    name: "Dossiers : ouverture, étapes et statuts",
    rights: {
      consult: grant("dossiers", "client"),
      create: grant("operationsWrite"),
      update: grant("operationsWrite"),
      validate: grant("admin"),
    },
    notes: [
      "Un dossier = un véhicule = un contrat = un ordre d’achat.",
      "Validation réservée à l’administrateur : exceptions de workflow et dérogation à la limite d’âge du véhicule.",
      "Un dossier ne se supprime pas : il se clôture ou s’annule (motif conservé).",
      "Le client ne voit que ses dossiers et les événements marqués « visible du client ».",
    ],
  },
  {
    id: "contracts",
    area: "Clients et dossiers",
    name: "Contrat, ordre d’achat et acceptations",
    rights: {
      consult: grant("dossiers", "client"),
      create: grant("operationsWrite"),
      update: grant("operationsWrite"),
      validate: grant("client"),
    },
    notes: [
      "Le client accepte dans son portail ; l’équipe enregistre une acceptation reçue par papier signé (scan) ou WhatsApp.",
      "Un contrat accepté est figé : la version acceptée est identifiée par son empreinte (SHA-256).",
    ],
  },
  {
    id: "containers",
    area: "Clients et dossiers",
    name: "Conteneurs, ETA et suivi",
    rights: {
      consult: grant("containers", "client"),
      create: grant("operationsWrite"),
      update: grant("operationsWrite"),
    },
    notes: [
      "L’ETA reste « indicative » tant que l’arrivée (ATA) n’est pas saisie ; aucune position en temps réel.",
      "Le client voit le conteneur de ses dossiers et les événements qui lui sont visibles.",
    ],
  },
  {
    id: "documents",
    area: "Clients et dossiers",
    name: "Documents",
    rights: { consult: grant("documents", "client"), create: grant("documentsWrite"), update: grant("documentsWrite") },
    notes: [
      "Modifier = régler la visibilité « client » ; un document enregistré n’est jamais modifié ni supprimé (une nouvelle version s’ajoute).",
      "Le client ne voit que les documents marqués « visible du client » (stockage privé, liens temporaires).",
    ],
  },
  {
    id: "release",
    area: "Clients et dossiers",
    name: "Remise des documents",
    rights: { consult: grant("dossiers", "client"), create: grant("operationsWrite") },
    notes: ["Enregistrée une fois le solde réglé ; l’enregistrement est figé."],
  },
  {
    id: "claims",
    area: "Clients et dossiers",
    name: "Réclamations après l’enlèvement",
    rights: {
      consult: grant("dossiers", "client"),
      create: grant("operationsWrite", "client"),
      update: grant("operationsWrite"),
    },
    notes: [
      "Le client dépose une réclamation pour ses propres dossiers ; l’équipe la traite et lui répond.",
      "Délai en jours ouvrés après l’enlèvement (paramètre) ; au-delà, la réclamation est « hors délai ».",
    ],
  },
  {
    id: "recovery",
    area: "Clients et dossiers",
    name: "Relances et mises en demeure",
    rights: { consult: grant("dossiers", "client"), create: grant("recoveryWrite"), update: grant("recoveryWrite") },
    notes: ["Le client voit les courriers qui lui ont été envoyés."],
  },
  {
    id: "unclaimed",
    area: "Clients et dossiers",
    name: "Procédure « véhicule non réclamé »",
    rights: { consult: grant("dossiers"), create: grant("procedureWrite"), update: grant("procedureWrite") },
    notes: ["Ouverture et clôture de la procédure par l’administrateur ou la direction."],
  },
  {
    id: "notifications",
    area: "Clients et dossiers",
    name: "Notifications au client",
    rights: {
      consult: grant("notifications", "client"),
      create: grant("notificationsTest"),
      update: grant("notificationsWrite"),
    },
    notes: [
      "Les messages partent automatiquement ; Modifier = renvoyer un message en échec ; Créer = message de test (administrateur).",
      "Aucune notification ne contient de coordonnées de paiement.",
    ],
  },
  // ---------------------------------------------------------------- Finances
  {
    id: "fx",
    area: "Finances",
    name: "Écran Finances et taux de change",
    rights: { consult: grant("finances"), create: grant("fxWrite") },
    notes: [
      "Taux du jour d’émission figé sur le devis ; réactualisé au jour de chaque paiement.",
      "Le client voit le taux figé sur ses propres documents.",
    ],
  },
  {
    id: "costs",
    area: "Finances",
    name: "Forfaits et coûts internes",
    rights: {
      consult: grant("dossiers"),
      create: grant("forfaitsWrite"),
      update: grant("forfaitsWrite"),
      delete: grant("forfaitsWrite"),
    },
    notes: [
      "Jamais visibles du client, ni à l’écran, ni dans un document, ni par l’API (garanti par la base).",
      "Supprimer : une ligne de coût interne saisie par erreur (seule suppression possible dans les finances).",
    ],
  },
  {
    id: "quotes",
    area: "Finances",
    name: "Devis",
    rights: {
      consult: grant("dossiers", "client"),
      create: grant("quotesWrite"),
      update: grant("quotesWrite"),
      validate: grant("client"),
    },
    notes: [
      "Le client voit les forfaits A et B, l’option C (assurance) et les ajustements D ; jamais les coûts internes.",
      "Un devis émis ne se modifie pas : il s’annule et un nouveau est émis. Valider = acceptation et choix d’assurance par le client.",
    ],
  },
  {
    id: "invoices",
    area: "Finances",
    name: "Factures et ajustements (frais, remises, retards)",
    rights: {
      consult: grant("dossiers", "client"),
      create: grant("invoicesWrite"),
      update: grant("invoicesWrite"),
      validate: grant("invoicesWrite", "client"),
    },
    notes: [
      "Factures d’acompte et de solde ; ajustements D : frais supplémentaires justifiés, remises, frais de retard.",
      "Valider : la comptabilité ou l’administrateur décide les frais de retard ; le client approuve les frais supplémentaires au-delà du seuil.",
    ],
  },
  {
    id: "payments",
    area: "Finances",
    name: "Paiements",
    rights: { consult: grant("dossiers", "client"), create: grant("paymentsWrite"), update: grant("paymentsWrite") },
    notes: [
      "Montants en USD (centimes), FCFA au taux du jour du paiement.",
      "Un paiement ne se supprime pas : il s’annule, avec un motif.",
    ],
  },
  {
    id: "refunds",
    area: "Finances",
    name: "Remboursements du trop-perçu",
    rights: { consult: grant("dossiers", "client"), update: grant("paymentsWrite"), validate: grant("admin") },
    notes: [
      "La demande est créée automatiquement ; seul l’administrateur la valide ; l’exécution (paiement) suit.",
      "Un trop-perçu est toujours restitué, jamais conservé comme avoir.",
    ],
  },
  {
    id: "accounts",
    area: "Finances",
    name: "Comptes officiels de paiement",
    rights: {
      consult: grant("settings", "client"),
      create: grant("accountsWrite"),
      update: grant("accountsWrite"),
      validate: grant("accountsApprove"),
    },
    notes: [
      "Double validation : un compte n’est actif qu’après approbation par une autre personne que son créateur.",
      "Le client ne voit que les comptes actifs, sur ses factures.",
    ],
  },
  // ---------------------------------------------------------------- Administration
  {
    id: "settings",
    area: "Administration",
    name: "Paramètres contractuels",
    rights: { consult: grant("settings"), update: grant("settingsWrite"), validate: grant("settingsWrite") },
    notes: [
      "Chaque modification ou validation crée une nouvelle version datée (administrateur, date, heure) ; les dossiers déjà ouverts gardent leurs valeurs.",
      "Une valeur « À compléter » ne peut jamais être confirmée.",
    ],
  },
  {
    id: "carriers",
    area: "Administration",
    name: "Transporteurs et liens de suivi",
    rights: { consult: grant("settings"), create: grant("settingsWrite"), update: grant("settingsWrite") },
    notes: [],
  },
  {
    id: "holidays",
    area: "Administration",
    name: "Jours fériés (jours ouvrés)",
    rights: { consult: grant("settings"), create: grant("holidaysWrite"), delete: grant("holidaysWrite") },
    notes: ["Utilisés pour calculer les délais en jours ouvrés."],
  },
  {
    id: "users",
    area: "Administration",
    name: "Utilisateurs et rôles",
    rights: { consult: grant("users"), create: grant("usersWrite"), update: grant("usersWrite") },
    notes: [
      "Modifier = changer le rôle, désactiver ou réactiver un compte, renvoyer une invitation.",
      "Un compte ne se supprime pas : il se désactive. Il reste toujours au moins un administrateur actif (garanti par la base).",
    ],
  },
  {
    id: "audit",
    area: "Administration",
    name: "Journal d’audit",
    rights: { consult: grant("audit") },
    notes: ["Immuable : personne ne peut le modifier ni le supprimer."],
  },
  {
    id: "erasures",
    area: "Administration",
    name: "Anonymisation des dossiers",
    rights: { consult: grant("erasures"), create: grant("erasuresWrite"), validate: grant("erasuresWrite") },
    notes: [
      "Seulement pour un dossier dont la durée de conservation est atteinte ; irréversible.",
      "Valider = approbation par un autre administrateur que le demandeur, puis exécution.",
    ],
  },
  {
    id: "roles-guide",
    area: "Administration",
    name: "Guide des rôles et droits (cette page)",
    rights: { consult: grant("rolesGuide") },
    notes: [],
  },
];

export const MODULE_AREAS: readonly ModuleArea[] = ["Pilotage", "Clients et dossiers", "Finances", "Administration"];

export function rolesFor(module: GuideModule, right: Right): readonly AppRole[] {
  return module.rights[right]?.roles ?? [];
}

/** Codes des droits d'un rôle sur un module (ex. « L C M »), vide si aucun accès. */
export function rightCodes(module: GuideModule, role: AppRole): string {
  return RIGHTS.filter((r) => rolesFor(module, r).includes(role))
    .map((r) => RIGHT_CODES[r])
    .join(" ");
}

/** Modules accessibles à un rôle, avec ses droits en clair. */
export function modulesForRole(role: AppRole): { module: GuideModule; rights: Right[] }[] {
  return MODULES.map((module) => ({ module, rights: RIGHTS.filter((r) => rolesFor(module, r).includes(role)) })).filter(
    (entry) => entry.rights.length > 0,
  );
}

// ---------------------------------------------------------------------------- Profils
export interface RoleProfile {
  role: (typeof GUIDE_ROLES)[number];
  mission: string;
  responsibilities: string[];
  restrictions: string[];
}

export const PROFILES: RoleProfile[] = [
  {
    role: "admin",
    mission:
      "Responsable du système : comptes et rôles, paramètres contractuels, contrôles et validations sensibles. Accès complet aux opérations et aux finances.",
    responsibilities: [
      "Créer les comptes de l’équipe, attribuer et changer les rôles, désactiver les comptes.",
      "Tenir à jour et valider les paramètres contractuels, les transporteurs et les jours fériés.",
      "Créer les comptes officiels de paiement (activés par une autre personne).",
      "Valider les exceptions : dérogation à la limite d’âge du véhicule, remboursements du trop-perçu.",
      "Demander, approuver (pour un autre administrateur) et exécuter les anonymisations.",
      "Surveiller le journal d’audit et faire la revue des accès.",
    ],
    restrictions: [
      "N’approuve jamais seul ce qu’il a lui-même créé ou demandé : compte officiel, anonymisation (double validation).",
      "Ne peut effacer aucun historique : journal d’audit, versions de paramètres, documents, paiements.",
      "Il doit toujours rester au moins un administrateur actif.",
    ],
  },
  {
    role: "management",
    mission:
      "Pilotage et contrôle : consulte l’ensemble de l’activité, approuve les comptes officiels et conduit la procédure « véhicule non réclamé ».",
    responsibilities: [
      "Suivre l’activité : dossiers, finances, rapports (dont la marge par véhicule, la conservation des données et la revue des accès).",
      "Approuver les comptes officiels de paiement créés par l’administrateur.",
      "Émettre les relances et mises en demeure ; ouvrir et clôturer la procédure « véhicule non réclamé ».",
      "Consulter les utilisateurs, le journal d’audit et l’historique des anonymisations.",
    ],
    restrictions: [
      "Pas de saisie opérationnelle (clients, dossiers, conteneurs, documents) ni financière (devis, factures, paiements, taux).",
      "Ne crée pas de comptes utilisateurs et ne modifie pas les paramètres.",
    ],
  },
  {
    role: "accounting",
    mission:
      "Facturation et encaissements : taux de change, devis, factures, paiements, remboursements validés et relances.",
    responsibilities: [
      "Relever chaque jour ouvré le taux USD → FCFA.",
      "Saisir les forfaits et les coûts internes ; émettre les devis, factures d’acompte et de solde.",
      "Gérer les ajustements : frais supplémentaires, remises, frais de retard.",
      "Enregistrer les paiements et exécuter les remboursements validés par l’administrateur.",
      "Émettre les relances et mises en demeure ; ajouter des documents.",
    ],
    restrictions: [
      "Ne valide pas les remboursements (administrateur) ; ne crée ni n’approuve les comptes officiels.",
      "Pas de saisie opérationnelle (dossiers, conteneurs, remise des documents).",
      "Pas d’accès aux utilisateurs, au journal d’audit ni aux rapports réservés (marge, conservation, revue des accès).",
    ],
  },
  {
    role: "ops",
    mission: "Traitement des dossiers au quotidien, de l’ouverture du dossier à l’enlèvement du véhicule à Dakar.",
    responsibilities: [
      "Créer et tenir à jour les fiches clients ; envoyer l’accès au portail.",
      "Ouvrir les dossiers : contrat, ordre d’achat, enchère, passage des étapes et statuts.",
      "Enregistrer les acceptations reçues par scan ou WhatsApp.",
      "Suivre les conteneurs, l’ETA et les événements ; gérer les documents et leur visibilité client.",
      "Saisir les forfaits et coûts internes, émettre les devis.",
      "Enregistrer la remise des documents ; traiter les réclamations ; renvoyer une notification en échec.",
    ],
    restrictions: [
      "Pas de factures, paiements, taux de change ni comptes officiels.",
      "Pas de dérogation d’âge ni de validation de remboursement.",
      "Relances et procédure « non réclamé » en lecture seule ; paramètres en lecture seule.",
      "Pas d’accès aux utilisateurs, au journal d’audit ni aux rapports financiers et réservés.",
    ],
  },
  {
    role: "client",
    mission: "Le client suit ses propres dossiers dans son portail (espace client, séparé de l’espace interne).",
    responsibilities: [
      "Consulter ses dossiers, le suivi, les documents visibles, ses devis, factures et paiements.",
      "Accepter le contrat, l’ordre d’achat et le devis (avec le choix de l’assurance).",
      "Approuver les frais supplémentaires au-delà du seuil ; déposer une réclamation après l’enlèvement.",
    ],
    restrictions: [
      "Ne voit jamais les données d’un autre client (garanti par la base et testé).",
      "Ne voit jamais les coûts internes ni la marge.",
      "Aucun accès à l’espace interne. Son compte est créé depuis la fiche client et il se connecte par un lien.",
    ],
  },
];

// ---------------------------------------------------------------------------- Validations croisées
export interface ValidationCircuit {
  name: string;
  steps: { who: string; what: string }[];
  rule: string;
}

export const VALIDATION_CIRCUITS: ValidationCircuit[] = [
  {
    name: "Comptes officiels de paiement",
    steps: [
      { who: "Administrateur", what: "crée ou remplace le compte (en attente d’approbation)" },
      { who: "Administrateur ou Direction", what: "approuve : le compte devient actif" },
    ],
    rule: "L’approbateur doit être une autre personne que le créateur (contrôlé par la base).",
  },
  {
    name: "Anonymisation d’un dossier",
    steps: [
      { who: "Administrateur", what: "demande l’anonymisation, avec un motif" },
      { who: "Autre administrateur", what: "approuve la demande" },
      { who: "Administrateur", what: "exécute (irréversible : données et fichiers effacés)" },
    ],
    rule: "Le demandeur ne peut pas approuver ; seulement si la durée de conservation est atteinte.",
  },
  {
    name: "Remboursement du trop-perçu",
    steps: [
      { who: "Système", what: "crée la demande de remboursement" },
      { who: "Administrateur", what: "valide ou rejette" },
      { who: "Comptabilité ou Administrateur", what: "exécute le remboursement" },
    ],
    rule: "Le trop-perçu est toujours restitué au client, jamais conservé comme avoir.",
  },
  {
    name: "Devis",
    steps: [
      { who: "Agent, Comptabilité ou Administrateur", what: "émet le devis (forfaits saisis manuellement)" },
      { who: "Client", what: "accepte et choisit l’assurance (portail, ou acceptation enregistrée par l’équipe)" },
    ],
    rule: "Un devis émis est figé ; pour le changer, on l’annule et on en émet un nouveau.",
  },
  {
    name: "Frais supplémentaires et frais de retard",
    steps: [
      {
        who: "Comptabilité ou Administrateur",
        what: "ajoute les frais justifiés, ou décide les frais de retard proposés",
      },
      { who: "Client", what: "approuve les frais supplémentaires au-delà du seuil fixé par les paramètres" },
    ],
    rule: "Les seuils et montants viennent des paramètres contractuels.",
  },
  {
    name: "Dérogation à la limite d’âge du véhicule",
    steps: [
      { who: "Agent", what: "prépare l’ordre d’achat ; le contrôle d’âge bloque" },
      { who: "Administrateur", what: "accorde la dérogation, avec un motif" },
    ],
    rule: "Réservée à l’administrateur.",
  },
  {
    name: "Procédure « véhicule non réclamé »",
    steps: [
      { who: "Comptabilité, Direction ou Administrateur", what: "émet relances et mises en demeure" },
      { who: "Direction ou Administrateur", what: "ouvre puis clôture la procédure" },
    ],
    rule: "Délais fixés par les paramètres contractuels.",
  },
  {
    name: "Paramètres contractuels",
    steps: [{ who: "Administrateur", what: "modifie ou valide un paramètre, avec un motif" }],
    rule: "Pas de double validation, mais chaque version est tracée (administrateur, date, heure) et journalisée.",
  },
];

// ---------------------------------------------------------------------------- Processus métier
export interface WorkflowStage {
  stage: DossierStage;
  what: string;
  who: string;
  validates: string;
}

export const WORKFLOW: WorkflowStage[] = [
  {
    stage: "opening",
    what: "Fiche client, ouverture du dossier, contrat et ordre d’achat générés.",
    who: "Agent opérations ou Administrateur",
    validates:
      "Client : acceptation du contrat et de l’ordre d’achat. Administrateur : dérogation d’âge si nécessaire.",
  },
  {
    stage: "purchase",
    what: "Enchère et résultat, devis (forfaits A et B), facture d’acompte, paiements.",
    who: "Agent (enchère, devis), Comptabilité (taux, factures, paiements)",
    validates: "Client : acceptation du devis et choix de l’assurance.",
  },
  {
    stage: "us_transport",
    what: "Enlèvement aux États-Unis, transit, réception au port.",
    who: "Agent opérations",
    validates: "—",
  },
  {
    stage: "container",
    what: "Chargement, conteneur confirmé, documents d’expédition.",
    who: "Agent opérations",
    validates: "—",
  },
  {
    stage: "ocean",
    what: "Départ, ETA indicative, arrivée ; le client est notifié.",
    who: "Agent opérations",
    validates: "—",
  },
  {
    stage: "dakar",
    what: "Avis d’arrivée, facture de solde, paiement, remise des documents, enlèvement.",
    who: "Comptabilité (solde, paiements), Agent (remise des documents, enlèvement)",
    validates:
      "Client : frais supplémentaires au-delà du seuil. Administrateur : remboursement du trop-perçu éventuel.",
  },
  {
    stage: "closing",
    what: "Dossier terminé ou archivé ; réclamations dans le délai ; procédure « non réclamé » si besoin ; anonymisation à l’échéance de conservation.",
    who: "Agent (réclamations), Direction ou Administrateur (procédure), Administrateurs (anonymisation)",
    validates: "Anonymisation : un second administrateur approuve.",
  },
];

// ---------------------------------------------------------------------------- Bonnes pratiques
export const GOOD_PRACTICES: string[] = [
  "Attribuer le rôle le plus restreint qui suffit au travail de la personne (moindre privilège).",
  "Avoir au moins deux administrateurs : indispensable pour les doubles validations (anonymisation) et pour ne jamais perdre l’accès.",
  "Un compte par personne, jamais partagé ; la double authentification est configurée à la première connexion pour les rôles qui l’exigent.",
  "Désactiver sans attendre le compte d’une personne qui quitte l’entreprise ou change de fonction (un compte se désactive, il ne se supprime pas).",
  "Changer le rôle d’un compte plutôt que créer un second compte ; chaque changement est journalisé (avant / après).",
  "Faire régulièrement la revue des accès (Rapports → Revue des accès) : rôles, double authentification, dernière connexion.",
  "Ne jamais communiquer de coordonnées de paiement par message : les comptes officiels se gèrent dans l’application, à deux validations.",
];

/** Principes de sécurité et de gouvernance (section d'introduction). */
export const PRINCIPLES: string[] = [
  "Les droits sont garantis par la base de données (sécurité au niveau des lignes et fonctions contrôlées), pas seulement par l’écran : un bouton absent n’est pas la seule protection.",
  "Un compte = une personne = un rôle. Les comptes de l’équipe sont créés par l’administrateur ; les comptes client, depuis la fiche client.",
  "Rien ne se supprime dans l’historique : on annule (avec un motif), on désactive, on crée une nouvelle version. Seules exceptions : une ligne de coût interne ou un jour férié saisis par erreur, et l’anonymisation à l’échéance de conservation.",
  "Toute action sensible est journalisée (auteur, rôle, date et heure, avant / après) dans le journal d’audit, que personne ne peut modifier.",
  "Les coûts internes et la marge ne sont jamais visibles du client ; un client ne voit jamais les données d’un autre client.",
  "Les validations sensibles exigent deux personnes différentes (comptes officiels, anonymisation).",
];
