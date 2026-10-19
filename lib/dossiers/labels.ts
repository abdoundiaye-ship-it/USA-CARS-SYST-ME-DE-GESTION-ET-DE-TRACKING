import type {
  AcceptanceMethod,
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
