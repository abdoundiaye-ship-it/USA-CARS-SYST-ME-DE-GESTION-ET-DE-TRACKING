import type { Metadata, Route } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { STAGE_LABELS } from "@/lib/dossiers/labels";
import { formatDateTime, formatUsd } from "@/lib/format";
import { nextClientAction } from "@/lib/portal";
import { clientDossierState } from "@/lib/server/portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mes dossiers" };

/** Portail — accueil : ses dossiers sous forme de cartes (véhicule, étape, prochaine action attendue). */
export default async function EspacePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: dossiers, error }, { data: statuses }] = await Promise.all([
    supabase
      .from("dossiers")
      .select("id, reference, stage, status, make, model, model_year")
      .order("created_at", { ascending: false }),
    supabase.from("workflow_statuses").select("stage, code, label"),
  ]);
  const states = new Map(
    await Promise.all((dossiers ?? []).map(async (d) => [d.id, await clientDossierState(d.id)] as const)),
  );
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Mes dossiers"
        description="Un dossier par véhicule : étapes, documents, paiements et arrivée."
      />
      {error ? (
        <Alert tone="danger">Vos dossiers n’ont pas pu être chargés. Rechargez la page.</Alert>
      ) : !dossiers?.length ? (
        <EmptyState title="Aucun dossier pour le moment">Vos dossiers apparaîtront ici dès leur ouverture.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {dossiers.map((d) => {
            const action = nextClientAction(states.get(d.id)!, now);
            const vehicle = [d.make, d.model, d.model_year].filter(Boolean).join(" ") || "Véhicule à préciser";
            const status = statuses?.find((s) => s.stage === d.stage && s.code === d.status)?.label ?? d.status;
            return (
              <li key={d.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div>
                    <h2 className="font-semibold">{vehicle}</h2>
                    <p className="text-muted text-sm">Dossier {d.reference}</p>
                  </div>
                  <p className="text-sm">
                    Étape <strong>{STAGE_LABELS[d.stage]}</strong> · <Badge tone="info">{status}</Badge>
                  </p>
                  <p className="text-sm">
                    <Badge
                      tone={
                        action.kind === "none"
                          ? "neutral"
                          : action.kind === "payment" && action.overdue
                            ? "danger"
                            : "warning"
                      }
                    >
                      {action.kind === "none" ? "À jour" : "À faire"}
                    </Badge>{" "}
                    {action.label}
                    {action.kind === "payment" && (
                      <>
                        {" "}
                        : <span className="amount">{formatUsd(action.amountCents)}</span>
                        {action.dueAt && ` avant le ${formatDateTime(action.dueAt)}`}
                      </>
                    )}
                  </p>
                  <Link
                    href={`/espace/dossiers/${d.id}` as Route}
                    className="text-primary mt-auto text-sm font-medium underline"
                  >
                    Voir le dossier {d.reference}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
