import type { Metadata, Route } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireInternal } from "@/lib/auth/access";
import { ROLE_LABELS, SCREEN_ROLES } from "@/lib/auth/roles";
import {
  buildIndicators,
  buildTodoList,
  calendarProgress,
  type DashboardContainer,
  type Severity,
} from "@/lib/dashboard";
import { CONTAINER_STATUS_LABELS, STAGE_LABELS, STAGES } from "@/lib/dossiers/labels";
import { formatUsd } from "@/lib/format";
import { currentNumbers } from "@/lib/server/settings-values";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { arrivalLabel } from "@/lib/tracking";

export const metadata: Metadata = { title: "Tableau de bord" };

const SETTING_KEYS = [
  "dashboard.stale_dossier_days",
  "dashboard.recent_eta_change_days",
  "tracking.max_days_without_check_in_transit",
  "unclaimed.reminder_days_after_arrival",
  "balance.recommended_days_before_eta",
  "arrival.notify_within_hours",
  "pickup.days_after_documents",
] as const;

const SEVERITY: Record<Severity, { tone: "danger" | "warning" | "info"; label: string }> = {
  danger: { tone: "danger", label: "Urgent" },
  warning: { tone: "warning", label: "À faire" },
  info: { tone: "info", label: "À suivre" },
};

/**
 * US-2.9 : liste « À traiter » et indicateurs pour toute l'équipe interne ; depuis le lot 3d, soldes, remboursements,
 * devis expirés et remise des documents. Seul l'indicateur des soldes dus affiche un montant (décision Q2).
 */
export default async function TableauDeBordPage() {
  const access = await requireInternal(SCREEN_ROLES.dashboard);
  const supabase = await createSupabaseServerClient();

  const [
    { data: dossiers, error },
    { data: confirmations },
    { data: released },
    { data: containers },
    { data: etaChanges },
    { data: assignments },
    settings,
    { data: finance },
    { data: releases },
    { data: arrivalEvents },
    { data: arrivalMessages },
    { data: arrivalNotices },
    { data: unclaimed },
  ] = await Promise.all([
    supabase.from("dossiers").select("id, reference, stage, status, updated_at, payment1_due_at, clients(name)"),
    supabase.from("dossier_confirmations").select("dossier_id, code"),
    supabase.from("documents").select("dossier_id").eq("kind", "release_receipt"),
    supabase.from("containers").select("id, number, status, etd, departed_on, eta, ata, last_checked_at"),
    supabase
      .from("eta_history")
      .select("container_id, changed_at")
      .not("previous_eta", "is", null)
      .order("changed_at", { ascending: false }),
    supabase.from("dossier_containers").select("dossier_id, container_id").is("removed_at", null),
    currentNumbers(SETTING_KEYS),
    supabase.rpc("finance_overview"),
    supabase.from("document_releases").select("dossier_id, released_at"),
    supabase.from("tracking_events").select("container_id, created_at").eq("kind", "arrival"),
    supabase.from("notifications").select("dossier_id").eq("template", "arrived").eq("status", "sent"),
    supabase.from("dossier_events").select("dossier_id").eq("kind", "arrival_notified"),
    supabase.rpc("unclaimed_overview", {}),
  ]);

  const containerRows: DashboardContainer[] = (containers ?? []).map((c) => ({
    ...c,
    eta_changed_at: etaChanges?.find((e) => e.container_id === c.id)?.changed_at ?? null,
    arrival_recorded_at: arrivalEvents?.find((e) => e.container_id === c.id)?.created_at ?? null,
  }));
  const data = {
    dossiers: (dossiers ?? []).map((d) => ({ ...d, client_name: d.clients?.name ?? null })),
    confirmations: confirmations ?? [],
    releasedDossierIds: new Set([
      ...(released ?? []).flatMap((r) => (r.dossier_id ? [r.dossier_id] : [])),
      ...(releases ?? []).map((r) => r.dossier_id),
    ]),
    finance: finance ?? [],
    containers: containerRows,
    assignments: assignments ?? [],
    // Message « arrivée » réellement envoyé (un envoi simulé n'informe pas le client) ou information par l'agent.
    arrivalNotifiedDossierIds: new Set([
      ...(arrivalMessages ?? []).flatMap((m) => (m.dossier_id ? [m.dossier_id] : [])),
      ...(arrivalNotices ?? []).map((e) => e.dossier_id),
    ]),
    releases: releases ?? [],
    unclaimed: unclaimed ?? [],
  };
  const unset = Number.POSITIVE_INFINITY; // paramètre absent : la règle ne se déclenche pas
  const todo = buildTodoList(data, {
    staleDossierDays: settings["dashboard.stale_dossier_days"] ?? unset,
    recentEtaChangeDays: settings["dashboard.recent_eta_change_days"] ?? -1,
    maxDaysWithoutCheck: settings["tracking.max_days_without_check_in_transit"] ?? unset,
    unclaimedReminderDays: settings["unclaimed.reminder_days_after_arrival"] ?? unset,
    arrivalNotifyHours: settings["arrival.notify_within_hours"] ?? unset,
    pickupDaysAfterDocuments: settings["pickup.days_after_documents"] ?? unset,
  });
  const arrivalWindow = settings["balance.recommended_days_before_eta"] ?? 7;
  const indicators = buildIndicators(data, arrivalWindow, todo);
  const moving = containerRows
    .filter((c) => !c.ata && c.departed_on)
    .sort((a, b) => (a.eta ?? "9999").localeCompare(b.eta ?? "9999"));

  return (
    <>
      <PageHeader
        title={`Bonjour ${access.fullName}`}
        description={`Connecté en tant que : ${ROLE_LABELS[access.role]}.`}
      />

      {error ? (
        <Alert tone="danger">Le tableau de bord n’a pas pu être chargé. Rechargez la page.</Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Dossiers actifs", indicators.activeDossiers],
              ["Conteneurs en mer", indicators.containersAtSea],
              [`Arrivées sous ${arrivalWindow} jours`, indicators.arrivalsSoon],
              ["Paiements 1 en retard", indicators.payment1Overdue],
              ["Soldes restant dus", formatUsd(indicators.balanceDueCents)],
            ].map(([label, value]) => (
              <Card key={label} className="flex flex-col gap-1 p-4">
                <p className="text-muted text-xs">{label}</p>
                <p className="amount text-2xl font-semibold">{value}</p>
              </Card>
            ))}
          </section>

          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">À traiter</h2>
            {todo.length === 0 ? (
              <EmptyState title="Rien à traiter">Aucune échéance dépassée ni alerte de suivi.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {todo.map((item) => (
                  <li
                    key={`${item.kind}-${item.href}`}
                    className="border-border flex flex-col gap-1 border-b pb-2 last:border-0 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <Badge tone={SEVERITY[item.severity].tone}>{SEVERITY[item.severity].label}</Badge>
                    <Link
                      href={item.href as Route}
                      className="text-primary font-medium whitespace-nowrap underline-offset-2 hover:underline"
                    >
                      {item.subject}
                    </Link>
                    <span className="text-sm">{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">Dossiers par étape</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {STAGES.map((stage) => (
                  <li key={stage} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/dossiers?etape=${stage}` as Route}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {STAGE_LABELS[stage]}
                    </Link>
                    <span className="amount font-medium">{indicators.byStage[stage]}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">Conteneurs partis</h2>
              <p className="text-muted text-xs">
                Progression calendaire entre le départ et l’ETA indicative — pas une position GPS.
              </p>
              {moving.length === 0 ? (
                <EmptyState title="Aucun conteneur en route" />
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  {moving.map((c) => {
                    const progress = calendarProgress(c);
                    return (
                      <li key={c.id} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/conteneurs/${c.id}` as Route} className="text-primary font-mono underline">
                            {c.number}
                          </Link>
                          <span className="text-muted text-xs">
                            {CONTAINER_STATUS_LABELS[c.status]} · {arrivalLabel(c)}
                          </span>
                        </div>
                        {progress !== null && (
                          <div
                            role="progressbar"
                            aria-label={`Progression calendaire du conteneur ${c.number}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress * 100)}
                            className="bg-background border-border h-2 overflow-hidden rounded-full border"
                          >
                            <div className="bg-primary h-full" style={{ width: `${Math.round(progress * 100)}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
