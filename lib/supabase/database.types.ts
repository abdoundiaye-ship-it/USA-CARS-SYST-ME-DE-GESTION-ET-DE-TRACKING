// Types de la base (schéma public), au format de `supabase gen types typescript`.
// Tenus à la main : plus précis que la génération (énumérations de statuts, colonnes en lecture seule).
// À mettre à jour avec chaque migration ; `pnpm db:types` sert seulement de référence de comparaison.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "ops" | "accounting" | "management" | "client";
export type DossierStage = "opening" | "purchase" | "us_transport" | "container" | "ocean" | "dakar" | "closing";
export type AuctionPlatform = "copart" | "iaa" | "other";
export type VehicleCategory = "passenger" | "light_utility" | "truck_or_bus";
export type AcceptanceMethod = "scanned_paper" | "whatsapp" | "portal";
export type ClientKind = "person" | "company";
export type IdDocumentType = "national_id" | "passport" | "residence_permit" | "other";
export type DocumentKind =
  | "contract"
  | "signed_contract"
  | "acceptance_proof"
  | "purchase_order"
  | "auction_invoice"
  | "pickup_proof"
  | "title"
  | "bill_of_lading"
  | "payment_proof"
  | "power_of_attorney"
  | "release_receipt"
  | "photos"
  | "cost_receipt"
  | "other";
export type ContractStatus = "pending" | "accepted" | "refused";
export type AcceptanceSubject = "contract" | "purchase_order" | "quote" | "extra_cost";
export type AcceptanceDecision = "accepted" | "refused";
export type DossierEventKind =
  | "opened"
  | "status_changed"
  | "stage_changed"
  | "contract_generated"
  | "purchase_order_generated"
  | "acceptance_recorded"
  | "auction_result"
  | "confirmation"
  | "stage_exception"
  | "cancelled"
  | "document_added"
  | "note"
  | "container_assigned"
  | "container_changed"
  | "eta_changed"
  | "tracking_event";
export type ContainerStatus =
  | "booking_confirmed"
  | "departure_planned"
  | "at_sea"
  | "transshipment"
  | "arrival_estimated"
  | "arrived";
export type EtaSource = "carrier_site" | "carrier_notice" | "manual";
export type TrackingEventKind = "departure" | "transshipment" | "arrival" | "eta_changed" | "delay" | "note";
export type PurchaseOrderStatus = "draft" | "pending" | "accepted" | "refused";
export type ConfirmationCode = "quote_accepted" | "payment1_received" | "balance_invoice_issued" | "balance_paid";

/** Insertion : colonnes obligatoires `Required`, les autres facultatives (valeurs par défaut de la base). */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

export type ClientRow = {
  id: string;
  kind: ClientKind;
  name: string;
  id_document_type: IdDocumentType | null;
  id_document_number: string | null;
  ninea: string | null;
  rccm: string | null;
  representative_name: string | null;
  representative_title: string | null;
  address: string | null;
  notify_phone: string;
  notify_email: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierRow = {
  id: string;
  reference: string;
  client_id: string;
  owner_id: string | null;
  stage: DossierStage;
  status: string;
  platform: AuctionPlatform | null;
  lot_number: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  mileage: number | null;
  vehicle_category: VehicleCategory | null;
  title_status: string | null;
  color: string | null;
  keys_present: boolean | null;
  declared_condition: string | null;
  purchase_location: string | null;
  departure_port: string | null;
  notes: string | null;
  params_as_of: string;
  duplicated_from: string | null;
  auction_result: "won" | "lost" | null;
  hammer_price_cents: number | null;
  lot_won_notified_at: string | null;
  payment1_due_at: string | null;
  price_override_reason: string | null;
  price_override_by: string | null;
  cancelled_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Colonnes modifiables directement d’un dossier. Figées par la base : référence, client, date d’ouverture ;
 * écrites par les fonctions métier seulement : étape, résultat d’enchère, annulation.
 */
type DossierEditable = Omit<
  DossierRow,
  | "id"
  | "reference"
  | "client_id"
  | "params_as_of"
  | "created_by"
  | "created_at"
  | "updated_at"
  | "duplicated_from"
  | "stage"
  | "auction_result"
  | "hammer_price_cents"
  | "lot_won_notified_at"
  | "payment1_due_at"
  | "price_override_reason"
  | "price_override_by"
  | "cancelled_reason"
>;

export type DocumentRow = {
  id: string;
  dossier_id: string | null;
  client_id: string;
  kind: DocumentKind;
  version: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  visible_client: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type ContractRow = {
  id: string;
  dossier_id: string;
  client_id: string;
  reference: string;
  template_version: string;
  document_id: string;
  document_sha256: string;
  status: ContractStatus;
  decided_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierEventRow = {
  id: number;
  dossier_id: string;
  occurred_at: string;
  kind: DossierEventKind;
  label: string;
  visible_client: boolean;
  actor_id: string | null;
};

export type AcceptanceRow = {
  id: string;
  dossier_id: string;
  subject: AcceptanceSubject;
  subject_id: string;
  document_id: string;
  document_sha256: string;
  method: AcceptanceMethod;
  decision: AcceptanceDecision;
  decided_at: string;
  proof_document_id: string | null;
  whatsapp_from: string | null;
  portal_ip: string | null;
  portal_session: string | null;
  acknowledgements: Json | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
};

export type PurchaseOrderRow = {
  id: string;
  dossier_id: string;
  auction_at: string | null;
  max_bid_cents: number;
  deposit_cents: number;
  status: PurchaseOrderStatus;
  document_id: string | null;
  document_sha256: string | null;
  template_version: string | null;
  platform: AuctionPlatform | null;
  lot_number: string | null;
  vin: string | null;
  decided_at: string | null;
  ack_vehicle_info: boolean;
  ack_import_age: boolean;
  ack_binding_win: boolean;
  ack_duties_excluded: boolean;
  age_override_reason: string | null;
  age_override_by: string | null;
  age_override_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CarrierRow = {
  id: string;
  code: string;
  name: string;
  tracking_url: string;
  url_template: string | null;
  link_type: "officiel" | "tiers";
  note: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContainerRow = {
  id: string;
  number: string;
  carrier_id: string;
  bl_number: string | null;
  vessel: string | null;
  voyage: string | null;
  port_of_loading: string | null;
  port_of_discharge: string;
  etd: string | null;
  eta: string | null;
  departed_on: string | null;
  ata: string | null;
  status: ContainerStatus;
  last_checked_at: string | null;
  last_checked_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EtaHistoryRow = {
  id: number;
  container_id: string;
  previous_eta: string | null;
  eta: string;
  source: EtaSource;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type TrackingEventRow = {
  id: number;
  container_id: string;
  occurred_at: string;
  kind: TrackingEventKind;
  label: string;
  location: string | null;
  source: "manual" | "carrier_link" | "api";
  visible_client: boolean;
  created_by: string | null;
  created_at: string;
};

export type DossierContainerRow = {
  id: string;
  dossier_id: string;
  container_id: string;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
};

export type FxRateRow = {
  id: string;
  /** numeric(12,4) : renvoyé en nombre par PostgREST ; manipulé en chaîne exacte pour les calculs (lib/money/fx). */
  rate: number;
  source: string;
  captured_at: string;
  created_by: string | null;
  created_at: string;
};

export type OfficialAccountKind = "bank" | "wave" | "orange_money" | "cash_office";
export type OfficialAccountRow = {
  id: string;
  kind: OfficialAccountKind;
  label: string;
  holder_name: string;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  phone: string | null;
  instructions: string | null;
  status: "pending_approval" | "active" | "inactive";
  replaces_id: string | null;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  deactivated_by: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
};

export type CostSection = "A" | "B";
export type CostCategory =
  | "hammer_price"
  | "auction_fees"
  | "us_taxes"
  | "acquisition_other"
  | "inland_transport"
  | "loading"
  | "ocean_freight"
  | "port_fees"
  | "documentation"
  | "logistics_other";
export type InternalCostRow = {
  id: string;
  dossier_id: string;
  section: CostSection;
  category: CostCategory;
  label: string | null;
  amount_cents: number;
  status: "estimated" | "final";
  document_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierForfaitsRow = {
  dossier_id: string;
  forfait_a_cents: number | null;
  forfait_b_cents: number | null;
  insurance_cents: number | null;
  mode: "manual" | "proposed_with_approval";
  proposed_a_cents: number | null;
  proposed_b_cents: number | null;
  approved_by: string | null;
  approved_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierConfirmationRow = {
  dossier_id: string;
  code: ConfirmationCode;
  note: string | null;
  confirmed_by: string | null;
  confirmed_at: string;
};

export type WorkflowStatusRow = {
  stage: DossierStage;
  code: string;
  label: string;
  position: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          client_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: AppRole;
          client_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: AppRole;
          client_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          value_type: string;
          status: "confirme" | "a_confirmer";
          source: string | null;
          reason: string | null;
          effective_from: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          value_type: string;
          status: "confirme" | "a_confirmer";
          source?: string | null;
          reason?: string | null;
          effective_from?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: InsertOf<ClientRow, "kind" | "name" | "notify_phone">;
        Update: Partial<Omit<ClientRow, "id" | "created_by" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      workflow_statuses: {
        Row: WorkflowStatusRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dossiers: {
        Row: DossierRow;
        // La référence est attribuée par la base (trigger) : la valeur fournie est ignorée.
        Insert: InsertOf<DossierRow, "client_id">;
        Update: Partial<DossierEditable>;
        Relationships: [
          {
            foreignKeyName: "dossiers_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dossiers_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: DocumentRow;
        Insert: InsertOf<
          DocumentRow,
          "client_id" | "kind" | "storage_path" | "file_name" | "mime_type" | "size_bytes" | "sha256"
        >;
        Update: Pick<DocumentRow, "visible_client">;
        Relationships: [
          {
            foreignKeyName: "documents_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: ContractRow;
        Insert: never; // via register_contract_document
        Update: never;
        Relationships: [
          {
            foreignKeyName: "contracts_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: true;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      dossier_events: {
        Row: DossierEventRow;
        Insert: InsertOf<DossierEventRow, "dossier_id" | "kind" | "label">;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "dossier_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      acceptances: {
        Row: AcceptanceRow;
        // Dossier, version et empreinte du contrat sont imposés par la base (trigger).
        Insert: InsertOf<
          AcceptanceRow,
          | "dossier_id"
          | "subject"
          | "subject_id"
          | "document_id"
          | "document_sha256"
          | "method"
          | "decision"
          | "decided_at"
        >;
        Update: never;
        Relationships: [];
      };
      purchase_orders: {
        Row: PurchaseOrderRow;
        Insert: InsertOf<PurchaseOrderRow, "dossier_id" | "max_bid_cents">;
        // Document, statut et décision : écrits par les fonctions métier.
        Update: Partial<Pick<PurchaseOrderRow, "auction_at" | "max_bid_cents" | "deposit_cents" | "age_override_reason">>;
        Relationships: [];
      };
      dossier_confirmations: {
        Row: DossierConfirmationRow;
        Insert: InsertOf<DossierConfirmationRow, "dossier_id" | "code">;
        Update: never;
        Relationships: [];
      };
      carriers: {
        Row: CarrierRow;
        Insert: InsertOf<CarrierRow, "code" | "name" | "tracking_url">;
        Update: Partial<Omit<CarrierRow, "id" | "created_by" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      containers: {
        Row: ContainerRow;
        Insert: InsertOf<ContainerRow, "number" | "carrier_id">;
        // ETA, départ, ATA, statut et vérification : écrits par les fonctions dédiées.
        Update: Partial<
          Pick<
            ContainerRow,
            "carrier_id" | "bl_number" | "vessel" | "voyage" | "port_of_loading" | "port_of_discharge" | "etd" | "notes"
          >
        >;
        Relationships: [
          {
            foreignKeyName: "containers_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
        ];
      };
      eta_history: {
        Row: EtaHistoryRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tracking_events: {
        Row: TrackingEventRow;
        Insert: InsertOf<TrackingEventRow, "container_id" | "occurred_at" | "kind" | "label">;
        Update: never;
        Relationships: [];
      };
      dossier_containers: {
        Row: DossierContainerRow;
        Insert: never; // via assign_container
        Update: never;
        Relationships: [
          {
            foreignKeyName: "dossier_containers_container_id_fkey";
            columns: ["container_id"];
            isOneToOne: false;
            referencedRelation: "containers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dossier_containers_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rates: {
        Row: FxRateRow;
        Insert: InsertOf<FxRateRow, "rate" | "source" | "captured_at">;
        Update: never;
        Relationships: [];
      };
      official_accounts: {
        Row: OfficialAccountRow;
        Insert: never; // via create_official_account
        Update: never; // via approve_official_account / deactivate_official_account
        Relationships: [];
      };
      internal_costs: {
        Row: InternalCostRow;
        Insert: InsertOf<InternalCostRow, "dossier_id" | "section" | "category" | "amount_cents">;
        Update: Partial<Pick<InternalCostRow, "label" | "amount_cents" | "status" | "document_id">>;
        Relationships: [];
      };
      dossier_forfaits: {
        Row: DossierForfaitsRow;
        Insert: InsertOf<DossierForfaitsRow, "dossier_id">;
        Update: Partial<Pick<DossierForfaitsRow, "forfait_a_cents" | "forfait_b_cents" | "insurance_cents">>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          at: string;
          actor_id: string | null;
          actor_role: AppRole | null;
          actor_label: string | null;
          action: string;
          object_type: string;
          object_id: string;
          before: Json | null;
          after: Json | null;
          reason: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      staff_directory: {
        Row: { id: string; full_name: string; role: AppRole; active: boolean };
        Relationships: [];
      };
      settings_current: {
        Row: {
          key: string;
          value: Json;
          value_type: string;
          status: "confirme" | "a_confirmer";
          source: string | null;
          reason: string | null;
          effective_from: string;
          created_by: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_role_app: { Args: Record<string, never>; Returns: AppRole | null };
      is_internal: { Args: Record<string, never>; Returns: boolean };
      my_access: {
        Args: Record<string, never>;
        Returns: { role: AppRole; active: boolean; full_name: string; mfa_required: boolean; aal: string }[];
      };
      next_number: { Args: { p_doc_type: string; p_year?: number }; Returns: string };
      is_operations_writer: { Args: Record<string, never>; Returns: boolean };
      status_label: { Args: { p_stage: DossierStage; p_code: string }; Returns: string };
      register_contract_document: {
        Args: {
          p_dossier_id: string;
          p_storage_path: string;
          p_file_name: string;
          p_size_bytes: number;
          p_sha256: string;
          p_template_version: string;
        };
        Returns: string;
      };
      duplicate_dossier: { Args: { p_dossier_id: string }; Returns: string };
      vehicle_age_check: {
        Args: { p_dossier_id: string };
        Returns: { status: "ok" | "too_old" | "unknown"; age: number | null; max_age: number | null }[];
      };
      register_purchase_order_document: {
        Args: {
          p_dossier_id: string;
          p_storage_path: string;
          p_file_name: string;
          p_size_bytes: number;
          p_sha256: string;
          p_template_version: string;
        };
        Returns: string;
      };
      record_auction_result: {
        Args: {
          p_dossier_id: string;
          p_result: "won" | "lost";
          p_hammer_price_cents?: number;
          p_notified_at?: string;
          p_override_reason?: string;
        };
        Returns: undefined;
      };
      stage_conditions: {
        Args: { p_dossier_id: string };
        Returns: { code: string; label: string; met: boolean }[];
      };
      advance_stage: { Args: { p_dossier_id: string; p_override_reason?: string }; Returns: DossierStage };
      cancel_dossier: { Args: { p_dossier_id: string; p_reason: string }; Returns: undefined };
      active_container_id: { Args: { p_dossier_id: string }; Returns: string | null };
      assign_container: {
        Args: { p_dossier_id: string; p_container_id: string; p_reason?: string };
        Returns: undefined;
      };
      update_container_eta: {
        Args: { p_container_id: string; p_eta: string; p_source: EtaSource; p_note?: string };
        Returns: undefined;
      };
      record_container_departure: { Args: { p_container_id: string; p_departed_on: string }; Returns: undefined };
      record_container_arrival: { Args: { p_container_id: string; p_ata: string }; Returns: undefined };
      mark_container_checked: { Args: { p_container_id: string }; Returns: undefined };
      fx_rate_as_of: {
        Args: { p_at: string };
        Returns: { id: string; rate: number; source: string; captured_at: string }[];
      };
      fx_rate_exists_on: { Args: { p_day: string }; Returns: boolean };
      create_official_account: {
        Args: {
          p_kind: OfficialAccountKind;
          p_label: string;
          p_holder_name: string;
          p_bank_name?: string;
          p_account_number?: string;
          p_iban?: string;
          p_swift?: string;
          p_phone?: string;
          p_instructions?: string;
          p_replaces_id?: string;
        };
        Returns: string;
      };
      approve_official_account: { Args: { p_account_id: string }; Returns: undefined };
      deactivate_official_account: { Args: { p_account_id: string; p_reason: string }; Returns: undefined };
      log_audit: {
        Args: {
          p_action: string;
          p_object_type: string;
          p_object_id: string;
          p_before?: Json;
          p_after?: Json;
          p_reason?: string;
          p_actor_label?: string;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: AppRole;
      dossier_stage: DossierStage;
      auction_platform: AuctionPlatform;
      vehicle_category: VehicleCategory;
      acceptance_method: AcceptanceMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};
