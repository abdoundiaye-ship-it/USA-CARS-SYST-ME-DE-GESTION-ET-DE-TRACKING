import { formatDate } from "@/lib/format";
import type { ConfirmationCode, ContainerStatus, DossierStage } from "@/lib/supabase/database.types";
import { trackingCheckOverdue } from "@/lib/tracking";

/**
 * Tableau de bord opérationnel (US-2.9, docs/14_ecrans_ux.md) : liste « À traiter » triée par gravité et
 * indicateurs, sans aucun montant. Fonctions pures : les données viennent de la base (RLS), les seuils des paramètres.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface DashboardDossier {
  id: string;
  reference: string;
  stage: DossierStage;
  status: string;
  updated_at: string;
  payment1_due_at: string | null;
  client_name: string | null;
}

export interface DashboardContainer {
  id: string;
  number: string;
  status: ContainerStatus;
  etd: string | null;
  departed_on: string | null;
  eta: string | null;
  ata: string | null;
  last_checked_at: string | null;
  /** Dernière modification de l'ETA (hors première saisie), d'après l'historique. */
  eta_changed_at: string | null;
}

export interface DashboardThresholds {
  staleDossierDays: number;
  recentEtaChangeDays: number;
  maxDaysWithoutCheck: number;
  unclaimedReminderDays: number;
}

export interface DashboardData {
  dossiers: DashboardDossier[];
  confirmations: { dossier_id: string; code: ConfirmationCode }[];
  releasedDossierIds: Set<string>;
  containers: DashboardContainer[];
  assignments: { dossier_id: string; container_id: string }[];
}

export type Severity = "danger" | "warning" | "info";

export interface TodoItem {
  severity: Severity;
  kind: "payment1_overdue" | "unclaimed" | "tracking_check" | "documents_to_release" | "eta_changed" | "stale";
  label: string;
  /** Référence du dossier ou numéro du conteneur concerné. */
  subject: string;
  href: `/dossiers/${string}` | `/conteneurs/${string}`;
  /** Date de référence (la plus ancienne en premier, à gravité égale). */
  since: string;
}

const RANK: Record<TodoItem["kind"], number> = {
  payment1_overdue: 1,
  unclaimed: 2,
  tracking_check: 3,
  documents_to_release: 4,
  eta_changed: 5,
  stale: 6,
};

const daysBetween = (from: string | Date, to: Date) => Math.floor((to.getTime() - new Date(from).getTime()) / DAY);

/** Liste « À traiter », de la plus grave à la moins grave. (« Devis expiré » arrive avec les devis, en phase 3.) */
export function buildTodoList(data: DashboardData, thresholds: DashboardThresholds, now = new Date()): TodoItem[] {
  const items: TodoItem[] = [];
  const confirmed = (dossierId: string, code: ConfirmationCode) =>
    data.confirmations.some((c) => c.dossier_id === dossierId && c.code === code);
  const containerOf = (dossierId: string) => {
    const assignment = data.assignments.find((a) => a.dossier_id === dossierId);
    return assignment ? data.containers.find((c) => c.id === assignment.container_id) : undefined;
  };

  for (const d of data.dossiers) {
    if (d.stage === "closing") continue;
    const href = `/dossiers/${d.id}` as const;
    if (
      d.stage === "purchase" &&
      d.payment1_due_at &&
      new Date(d.payment1_due_at) < now &&
      !confirmed(d.id, "payment1_received")
    ) {
      items.push({
        severity: "danger",
        kind: "payment1_overdue",
        label: `Paiement 1 en retard depuis le ${formatDate(d.payment1_due_at)}`,
        subject: d.reference,
        href,
        since: d.payment1_due_at,
      });
    }
    if (d.stage === "dakar") {
      const ata = containerOf(d.id)?.ata;
      if (ata && d.status !== "collected" && daysBetween(ata, now) > thresholds.unclaimedReminderDays) {
        items.push({
          severity: "danger",
          kind: "unclaimed",
          label: `Véhicule non enlevé ${daysBetween(ata, now)} jours après l’arrivée`,
          subject: d.reference,
          href,
          since: ata,
        });
      }
      if (confirmed(d.id, "balance_paid") && !data.releasedDossierIds.has(d.id)) {
        items.push({
          severity: "warning",
          kind: "documents_to_release",
          label: "Solde réglé : documents à remettre au client",
          subject: d.reference,
          href,
          since: d.updated_at,
        });
      }
    }
    if (daysBetween(d.updated_at, now) > thresholds.staleDossierDays) {
      items.push({
        severity: "info",
        kind: "stale",
        label: `Sans mise à jour depuis ${daysBetween(d.updated_at, now)} jours`,
        subject: d.reference,
        href,
        since: d.updated_at,
      });
    }
  }

  for (const c of data.containers) {
    const href = `/conteneurs/${c.id}` as const;
    if (trackingCheckOverdue(c, thresholds.maxDaysWithoutCheck, now)) {
      items.push({
        severity: "warning",
        kind: "tracking_check",
        label: "Conteneur en mer : suivi à vérifier",
        subject: c.number,
        href,
        since: c.last_checked_at ?? c.departed_on ?? now.toISOString(),
      });
    }
    if (!c.ata && c.eta && c.eta_changed_at && daysBetween(c.eta_changed_at, now) <= thresholds.recentEtaChangeDays) {
      items.push({
        severity: "info",
        kind: "eta_changed",
        label: `ETA indicative modifiée : ${formatDate(c.eta)}`,
        subject: c.number,
        href,
        since: c.eta_changed_at,
      });
    }
  }

  return items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.since.localeCompare(b.since));
}

export interface DashboardIndicators {
  activeDossiers: number;
  byStage: Record<DossierStage, number>;
  containersAtSea: number;
  arrivalsSoon: number;
  payment1Overdue: number;
}

/** Indicateurs (aucun montant) ; « arrivées prochaines » : ETA dans les `arrivalWindowDays` jours. */
export function buildIndicators(
  data: DashboardData,
  arrivalWindowDays: number,
  todo: TodoItem[],
  now = new Date(),
): DashboardIndicators {
  const byStage = { opening: 0, purchase: 0, us_transport: 0, container: 0, ocean: 0, dakar: 0, closing: 0 };
  for (const d of data.dossiers) byStage[d.stage] += 1;
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + arrivalWindowDays * DAY).toISOString().slice(0, 10);
  return {
    activeDossiers: data.dossiers.length - byStage.closing,
    byStage,
    containersAtSea: data.containers.filter((c) => !c.ata && (c.status === "at_sea" || c.status === "transshipment"))
      .length,
    arrivalsSoon: data.containers.filter((c) => !c.ata && c.eta && c.eta >= today && c.eta <= horizon).length,
    payment1Overdue: todo.filter((t) => t.kind === "payment1_overdue").length,
  };
}

/**
 * Progression calendaire d'un conteneur entre son départ et son ETA indicative (0 à 1) — une simple
 * proportion de jours écoulés, jamais une position (CLAUDE.md règle 6). null si elle ne peut pas être calculée.
 */
export function calendarProgress(
  c: Pick<DashboardContainer, "departed_on" | "eta" | "ata">,
  now = new Date(),
): number | null {
  if (c.ata) return 1;
  if (!c.departed_on || !c.eta) return null;
  const start = new Date(c.departed_on).getTime();
  const end = new Date(c.eta).getTime();
  if (end <= start) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}
