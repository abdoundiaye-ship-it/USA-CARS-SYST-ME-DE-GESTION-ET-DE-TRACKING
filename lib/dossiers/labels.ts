import type {
  AcceptanceMethod,
  ConfirmationCode,
  ContainerStatus,
  EtaSource,
  TrackingEventKind,
  PurchaseOrderStatus,
  AuctionPlatform,
  ClientKind,
  ContractStatus,
  DocumentKind,
  DossierStage,
  IdDocumentType,
  VehicleCategory,
} from "@/lib/supabase/database.types";

/** Libellés français des données opérationnelles (vocabulaire métier, CLAUDE.md §5). */

/** Les 7 étapes du dossier, dans l'ordre (docs/13_workflow_statuts.md). */
export const STAGES: readonly DossierStage[] = [
  "opening",
  "purchase",
  "us_transport",
  "container",
  "ocean",
  "dakar",
  "closing",
];

export const STAGE_LABELS: Record<DossierStage, string> = {
  opening: "Ouverture",
  purchase: "Achat",
  us_transport: "Transport USA",
  container: "Conteneur",
  ocean: "Maritime",
  dakar: "Dakar",
  closing: "Clôture",
};

export const PLATFORM_LABELS: Record<AuctionPlatform, string> = {
  copart: "COPART",
  iaa: "IAA",
  other: "Autre",
};

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  passenger: "Véhicule de tourisme",
  light_utility: "Utilitaire léger (< 3,5 t)",
  truck_or_bus: "Camion ou transport de personnes",
};

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  person: "Particulier",
  company: "Société",
};

export const ID_DOCUMENT_LABELS: Record<IdDocumentType, string> = {
  national_id: "Carte d’identité",
  passport: "Passeport",
  residence_permit: "Titre de séjour",
  other: "Autre pièce",
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  contract: "Contrat (généré)",
  signed_contract: "Contrat signé",
  acceptance_proof: "Preuve d’acceptation",
  purchase_order: "Ordre d’achat",
  auction_invoice: "Facture d’enchère",
  pickup_proof: "Preuve de prise en charge",
  title: "Titre du véhicule",
  bill_of_lading: "B/L",
  payment_proof: "Preuve de paiement",
  power_of_attorney: "Procuration",
  release_receipt: "Décharge de remise",
  photos: "Photos",
  other: "Autre document",
};

export const ACCEPTANCE_METHOD_LABELS: Record<AcceptanceMethod, string> = {
  scanned_paper: "Papier signé et scanné",
  whatsapp: "Validation par WhatsApp",
  portal: "Acceptation dans le portail",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  pending: "En attente de signature",
  accepted: "Accepté",
  refused: "Refusé",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Saisi — document à générer",
  pending: "En attente de signature",
  accepted: "Signé",
  refused: "Refusé",
};

/** Confirmations manuelles en attendant la phase 3 (hypothèse P1). */
export const CONFIRMATION_LABELS: Record<ConfirmationCode, string> = {
  quote_accepted: "Devis accepté par le client",
  payment1_received: "Paiement 1 intégralement reçu",
  balance_invoice_issued: "Facture de solde émise",
  balance_paid: "Solde réglé",
};

/** Les 4 confirmations de l’annexe B, cochées par le client sur l’ordre d’achat signé. */
export const PURCHASE_ORDER_ACKNOWLEDGEMENTS = [
  ["vehicle_info", "a pris connaissance des informations et photos de la plateforme et accepte le véhicule en l’état"],
  ["import_age", "a vérifié que l’âge du véhicule respecte la limite d’importation au Sénégal"],
  ["binding_win", "sait que le lot remporté l’engage et que le paiement 1 est dû dans le délai de l’article 9.1"],
  ["duties_excluded", "sait que les droits et taxes au Sénégal ne sont pas inclus, sauf mention au devis"],
] as const;

/** Statuts du conteneur (mêmes codes que l’étape Maritime du dossier). */
export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
  booking_confirmed: "Réservation confirmée",
  departure_planned: "Départ prévu",
  at_sea: "En transit",
  transshipment: "Transbordement",
  arrival_estimated: "Arrivée estimée",
  arrived: "Arrivé",
};

export const ETA_SOURCE_LABELS: Record<EtaSource, string> = {
  carrier_site: "Site de suivi du transporteur",
  carrier_notice: "Avis du transporteur (e-mail, courrier)",
  manual: "Estimation de l’agent",
};

export const TRACKING_EVENT_LABELS: Record<TrackingEventKind, string> = {
  departure: "Départ",
  transshipment: "Transbordement",
  arrival: "Arrivée",
  eta_changed: "ETA modifiée",
  delay: "Retard",
  note: "Information",
};
