import type { AppRole } from "@/lib/supabase/database.types";

export type { AppRole };

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  ops: "Agent opérations",
  accounting: "Comptabilité",
  management: "Direction",
  client: "Client",
};

/** Rôles de l’espace interne. Les comptes client sont créés avec leur fiche client (phases 2 et 4). */
export const INTERNAL_ROLES = ["admin", "ops", "accounting", "management"] as const satisfies readonly AppRole[];

export type InternalRole = (typeof INTERNAL_ROLES)[number];

export function isInternalRole(role: AppRole | null | undefined): role is InternalRole {
  return role != null && (INTERNAL_ROLES as readonly AppRole[]).includes(role);
}

/** Droits d’accès aux écrans (docs/12_roles_permissions.md). */
export const SCREEN_ROLES = {
  dashboard: INTERNAL_ROLES,
  users: ["admin", "management"],
  usersWrite: ["admin"],
  settings: INTERNAL_ROLES,
  settingsWrite: ["admin"],
  audit: ["admin", "management"],
  // Phase 2 — opérations (docs/12_roles_permissions.md) : internes L, admin et agent opérations E.
  clients: INTERNAL_ROLES,
  dossiers: INTERNAL_ROLES,
  operationsWrite: ["admin", "ops"],
  containers: INTERNAL_ROLES,
  documents: INTERNAL_ROLES,
  // Documents : admin, agent et comptabilité ajoutent et règlent la visibilité client (docs/12).
  documentsWrite: ["admin", "ops", "accounting"],
  // Phase 3 — finances (docs/12, décisions I4 et Q1).
  finances: ["admin", "accounting", "management"],
  fxWrite: ["admin", "accounting"],
  forfaitsWrite: ["admin", "ops", "accounting"],
  accountsWrite: ["admin"],
  accountsApprove: ["admin", "management"],
} as const satisfies Record<string, readonly AppRole[]>;

export function canAccess(role: AppRole | null | undefined, allowed: readonly AppRole[]): boolean {
  return role != null && allowed.includes(role);
}
