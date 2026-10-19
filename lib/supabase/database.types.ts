
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "acceptances": {
                  Row: {
                    "decided_at": string,"decision": string,"document_id": string,"document_sha256": string,"dossier_id": string,"id": string,"method": Database["public"]['Enums']["acceptance_method"],"notes": string | null,"portal_ip": unknown,"portal_session": string | null,"proof_document_id": string | null,"recorded_at": string,"recorded_by": string | null,"subject": string,"subject_id": string,"whatsapp_from": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at": string,"decision": string,"document_id": string,"document_sha256": string,"dossier_id": string,"id"?: string,"method": Database["public"]['Enums']["acceptance_method"],"notes"?: string | null,"portal_ip"?: unknown,"portal_session"?: string | null,"proof_document_id"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"subject": string,"subject_id": string,"whatsapp_from"?: string | null
                  }
                  Update: {
                    "decided_at"?: string,"decision"?: string,"document_id"?: string,"document_sha256"?: string,"dossier_id"?: string,"id"?: string,"method"?: Database["public"]['Enums']["acceptance_method"],"notes"?: string | null,"portal_ip"?: unknown,"portal_session"?: string | null,"proof_document_id"?: string | null,"recorded_at"?: string,"recorded_by"?: string | null,"subject"?: string,"subject_id"?: string,"whatsapp_from"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "acceptances_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acceptances_dossier_id_fkey"
      columns: ["dossier_id"]
isOneToOne: false
      referencedRelation: "dossiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acceptances_proof_document_id_fkey"
      columns: ["proof_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acceptances_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_label": string | null,"actor_role": Database["public"]['Enums']["app_role"] | null,"after": Json | null,"at": string,"before": Json | null,"id": number,"object_id": string,"object_type": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_label"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"object_id": string,"object_type": string,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_label"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"object_id"?: string,"object_type"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"clients": {
                  Row: {
                    "active": boolean,"address": string | null,"created_at": string,"created_by": string | null,"id": string,"id_document_number": string | null,"id_document_type": string | null,"kind": string,"name": string,"ninea": string | null,"notes": string | null,"notify_email": string | null,"notify_phone": string,"rccm": string | null,"representative_name": string | null,"representative_title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"id_document_number"?: string | null,"id_document_type"?: string | null,"kind": string,"name": string,"ninea"?: string | null,"notes"?: string | null,"notify_email"?: string | null,"notify_phone": string,"rccm"?: string | null,"representative_name"?: string | null,"representative_title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"id_document_number"?: string | null,"id_document_type"?: string | null,"kind"?: string,"name"?: string,"ninea"?: string | null,"notes"?: string | null,"notify_email"?: string | null,"notify_phone"?: string,"rccm"?: string | null,"representative_name"?: string | null,"representative_title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"decided_at": string | null,"document_id": string,"document_sha256": string,"dossier_id": string,"id": string,"reference": string,"status": string,"template_version": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"document_id": string,"document_sha256": string,"dossier_id": string,"id"?: string,"reference": string,"status"?: string,"template_version": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"document_id"?: string,"document_sha256"?: string,"dossier_id"?: string,"id"?: string,"reference"?: string,"status"?: string,"template_version"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_dossier_id_fkey"
      columns: ["dossier_id"]
isOneToOne: true
      referencedRelation: "dossiers"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "client_id": string,"dossier_id": string | null,"file_name": string,"id": string,"kind": string,"mime_type": string,"sha256": string,"size_bytes": number,"storage_path": string,"uploaded_at": string,"uploaded_by": string | null,"version": number,"visible_client": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"dossier_id"?: string | null,"file_name": string,"id"?: string,"kind": string,"mime_type": string,"sha256": string,"size_bytes": number,"storage_path": string,"uploaded_at"?: string,"uploaded_by"?: string | null,"version"?: number,"visible_client"?: boolean
                  }
                  Update: {
                    "client_id"?: string,"dossier_id"?: string | null,"file_name"?: string,"id"?: string,"kind"?: string,"mime_type"?: string,"sha256"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_at"?: string,"uploaded_by"?: string | null,"version"?: number,"visible_client"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_dossier_id_fkey"
      columns: ["dossier_id"]
isOneToOne: false
      referencedRelation: "dossiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dossier_events": {
                  Row: {
                    "actor_id": string | null,"dossier_id": string,"id": number,"kind": string,"label": string,"occurred_at": string,"visible_client": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"dossier_id": string,"id"?: never,"kind": string,"label": string,"occurred_at"?: string,"visible_client"?: boolean
                  }
                  Update: {
                    "actor_id"?: string | null,"dossier_id"?: string,"id"?: never,"kind"?: string,"label"?: string,"occurred_at"?: string,"visible_client"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "dossier_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dossier_events_dossier_id_fkey"
      columns: ["dossier_id"]
isOneToOne: false
      referencedRelation: "dossiers"
      referencedColumns: ["id"]
    }
                  ]
                },"dossiers": {
                  Row: {
                    "client_id": string,"color": string | null,"created_at": string,"created_by": string | null,"declared_condition": string | null,"departure_port": string | null,"duplicated_from": string | null,"id": string,"keys_present": boolean | null,"lot_number": string | null,"make": string | null,"mileage": number | null,"model": string | null,"model_year": number | null,"notes": string | null,"owner_id": string | null,"params_as_of": string,"platform": Database["public"]['Enums']["auction_platform"] | null,"purchase_location": string | null,"reference": string,"stage": Database["public"]['Enums']["dossier_stage"],"status": string,"title_status": string | null,"updated_at": string,"vehicle_category": Database["public"]['Enums']["vehicle_category"] | null,"vin": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"declared_condition"?: string | null,"departure_port"?: string | null,"duplicated_from"?: string | null,"id"?: string,"keys_present"?: boolean | null,"lot_number"?: string | null,"make"?: string | null,"mileage"?: number | null,"model"?: string | null,"model_year"?: number | null,"notes"?: string | null,"owner_id"?: string | null,"params_as_of"?: string,"platform"?: Database["public"]['Enums']["auction_platform"] | null,"purchase_location"?: string | null,"reference": string,"stage"?: Database["public"]['Enums']["dossier_stage"],"status"?: string,"title_status"?: string | null,"updated_at"?: string,"vehicle_category"?: Database["public"]['Enums']["vehicle_category"] | null,"vin"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"color"?: string | null,"created_at"?: string,"created_by"?: string | null,"declared_condition"?: string | null,"departure_port"?: string | null,"duplicated_from"?: string | null,"id"?: string,"keys_present"?: boolean | null,"lot_number"?: string | null,"make"?: string | null,"mileage"?: number | null,"model"?: string | null,"model_year"?: number | null,"notes"?: string | null,"owner_id"?: string | null,"params_as_of"?: string,"platform"?: Database["public"]['Enums']["auction_platform"] | null,"purchase_location"?: string | null,"reference"?: string,"stage"?: Database["public"]['Enums']["dossier_stage"],"status"?: string,"title_status"?: string | null,"updated_at"?: string,"vehicle_category"?: Database["public"]['Enums']["vehicle_category"] | null,"vin"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dossiers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dossiers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dossiers_duplicated_from_fkey"
      columns: ["duplicated_from"]
isOneToOne: false
      referencedRelation: "dossiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dossiers_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dossiers_stage_status_fkey"
      columns: ["stage","status"]
isOneToOne: false
      referencedRelation: "workflow_statuses"
      referencedColumns: ["stage","code"]
    }
                  ]
                },"number_sequences": {
                  Row: {
                    "doc_type": string,"last_value": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "doc_type": string,"last_value"?: number,"year": number
                  }
                  Update: {
                    "doc_type"?: string,"last_value"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"client_id": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"client_id"?: string | null,"created_at"?: string,"email": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"client_id"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_client_fk"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"effective_from": string,"key": string,"reason": string | null,"source": string | null,"status": string,"value": NonNullable<Json>,"value_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"key": string,"reason"?: string | null,"source"?: string | null,"status": string,"value": NonNullable<Json>,"value_type": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"key"?: string,"reason"?: string | null,"source"?: string | null,"status"?: string,"value"?: NonNullable<Json>,"value_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workflow_statuses": {
                  Row: {
                    "code": string,"label": string,"position": number,"stage": Database["public"]['Enums']["dossier_stage"]
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"label": string,"position": number,"stage": Database["public"]['Enums']["dossier_stage"]
                  }
                  Update: {
                    "code"?: string,"label"?: string,"position"?: number,"stage"?: Database["public"]['Enums']["dossier_stage"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "settings_current": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"effective_from": string | null,"key": string | null,"reason": string | null,"source": string | null,"status": string | null,"value": Json | null,"value_type": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "settings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "actor_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"add_dossier_event":
{ Args: { "p_dossier_id": string,"p_kind": string,"p_label": string,"p_visible_client": boolean }; Returns: undefined
                           },
"current_client_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_role_app":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"duplicate_dossier":
{ Args: { "p_dossier_id": string }; Returns: string
                           },
"format_document_number":
{ Args: { "p_pattern": string,"p_value": number,"p_year": number }; Returns: string
                           },
"is_internal":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_operations_writer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_audit":
{ Args: { "p_action": string,"p_actor_label"?: string,"p_after"?: Json,"p_before"?: Json,"p_object_id": string,"p_object_type": string,"p_reason"?: string }; Returns: number
                           },
"my_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "aal": string,"active": boolean,"full_name": string,"mfa_required": boolean,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"next_number":
{ Args: { "p_doc_type": string,"p_year"?: number }; Returns: string
                           },
"register_contract_document":
{ Args: { "p_dossier_id": string,"p_file_name": string,"p_sha256": string,"p_size_bytes": number,"p_storage_path": string,"p_template_version": string }; Returns: string
                           },
"role_requires_mfa":
{ Args: { "p_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"setting_as_of":
{ Args: { "p_at": string,"p_key": string }; Returns: Json
                           },
"setting_value":
{ Args: { "p_key": string }; Returns: Json
                           },
"status_label":
{ Args: { "p_code": string,"p_stage": Database["public"]['Enums']["dossier_stage"] }; Returns: string
                           }
          }
          Enums: {
            "acceptance_method": "scanned_paper"|"whatsapp"|"portal","app_role": "admin"|"ops"|"accounting"|"management"|"client","auction_platform": "copart"|"iaa"|"other","dossier_stage": "opening"|"purchase"|"us_transport"|"container"|"ocean"|"dakar"|"closing","vehicle_category": "passenger"|"light_utility"|"truck_or_bus"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "acceptance_method": ["scanned_paper", "whatsapp", "portal"],"app_role": ["admin", "ops", "accounting", "management", "client"],"auction_platform": ["copart", "iaa", "other"],"dossier_stage": ["opening", "purchase", "us_transport", "container", "ocean", "dakar", "closing"],"vehicle_category": ["passenger", "light_utility", "truck_or_bus"]
          }
        }
} as const
