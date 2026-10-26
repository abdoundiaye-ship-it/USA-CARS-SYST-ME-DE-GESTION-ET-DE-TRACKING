import type { DossierErasureScope, DossierErasureStatus } from "@/lib/supabase/database.types";

/**
 * Anonymisation des dossiers dont la durée de conservation est atteinte (décisions G2-c/G2-d, contrat art. 33).
 * Libellés et teintes pour l'interface ; la logique métier est dans la base (migration 20261026100000).
 */

export const ERASURE_STATUS_LABELS: Record<DossierErasureStatus, string> = {
  pending_approval: "En attente d’approbation",
  approved: "Approuvée — à exécuter",
  executed: "Anonymisation effectuée",
  cancelled: "Annulée",
};

export const ERASURE_SCOPE_LABELS: Record<DossierErasureScope, string> = {
  other_data: "Identité, pièces, suivi et notifications",
  all: "Toutes les données, y compris les pièces comptables",
};

/** Ce que l'anonymisation conserve selon la portée atteinte (information affichée avant l'exécution). */
export const ERASURE_SCOPE_KEPT: Record<DossierErasureScope, string> = {
  other_data: "Les pièces comptables (devis, factures, reçus, paiements) sont conservées jusqu’à 10 ans.",
  all: "Seules les archives internes de USA CARS (coûts internes, factures fournisseurs) sont conservées.",
};

export function erasureStatusTone(status: DossierErasureStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "pending_approval":
      return "warning";
    case "approved":
      return "info";
    case "executed":
      return "success";
    case "cancelled":
      return "neutral";
  }
}

/** Une portée atteinte est effaçable (l'échéance « autres données » ou « toutes » est dépassée). */
export function isErasableScope(scope: string | null): scope is DossierErasureScope {
  return scope === "other_data" || scope === "all";
}
