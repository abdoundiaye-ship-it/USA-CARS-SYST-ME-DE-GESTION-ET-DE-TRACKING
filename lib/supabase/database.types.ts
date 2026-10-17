// Types de la base (schéma public), au format de `supabase gen types typescript`.
// Écrits à la main en phase 1 (pas de Docker sur le poste de développement) :
// à régénérer avec `pnpm db:types` dès que Supabase local est disponible.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "ops" | "accounting" | "management" | "client";

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
    Enums: { app_role: AppRole };
    CompositeTypes: Record<string, never>;
  };
};
