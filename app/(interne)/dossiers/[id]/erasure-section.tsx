import { Alert, Badge, Card } from "@/components/ui/feedback";
import {
  ERASURE_SCOPE_KEPT,
  ERASURE_SCOPE_LABELS,
  ERASURE_STATUS_LABELS,
  erasureStatusTone,
  isErasableScope,
} from "@/lib/erasure";
import { formatDateTime } from "@/lib/format";
import type { DossierErasureRow } from "@/lib/supabase/database.types";
import { ApproveErasureForm, CancelErasureForm, ExecuteErasureForm, RequestErasureForm } from "../erasure-forms";

/**
 * Anonymisation des données du dossier (décisions G2-c/G2-d, contrat art. 33). Section réservée à l'administrateur,
 * visible uniquement lorsque la durée de conservation est atteinte ou qu'une anonymisation a déjà été engagée.
 * L'identité du client et les pièces « autres données » sont effacées à 5 ans, les pièces comptables à 10 ans.
 */
export function ErasureSection({
  dossierId,
  scope,
  erasures,
  currentUserId,
  staffName,
}: {
  dossierId: string;
  scope: string | null;
  erasures: DossierErasureRow[];
  currentUserId: string;
  staffName: (id: string | null) => string | null;
}) {
  const open = erasures.find((e) => e.status === "pending_approval" || e.status === "approved") ?? null;
  const history = erasures.filter((e) => e.status === "executed" || e.status === "cancelled");

  // Rien à proposer ni à montrer : dossier non éligible et aucune anonymisation engagée.
  if (!open && history.length === 0 && !isErasableScope(scope)) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold">Anonymisation des données</h2>
        <p className="text-muted mt-1 text-sm">
          À l’échéance de conservation (contrat art. 33) : l’identité du client, les pièces, le suivi et les
          notifications sont effacés ; les pièces comptables sont conservées jusqu’à 10 ans. Les données du véhicule et
          les archives internes de USA CARS sont conservées.
        </p>
      </div>

      {open ? (
        <div className="border-border rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={erasureStatusTone(open.status)}>{ERASURE_STATUS_LABELS[open.status]}</Badge>
            <Badge tone="neutral">{ERASURE_SCOPE_LABELS[open.scope]}</Badge>
            <span className="text-muted text-xs">
              Demandée par {staffName(open.requested_by) ?? "—"} le {formatDateTime(open.requested_at)}
            </span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-line">{open.reason}</p>
          <p className="text-muted mt-1 text-xs">{ERASURE_SCOPE_KEPT[open.scope]}</p>

          {open.status === "pending_approval" ? (
            <div className="border-border mt-3 flex flex-col gap-3 border-t pt-3">
              {open.requested_by === currentUserId ? (
                <Alert tone="info">
                  Double validation : une autre personne que vous (le demandeur) doit approuver cette anonymisation.
                </Alert>
              ) : (
                <ApproveErasureForm erasureId={open.id} dossierId={dossierId} />
              )}
              <CancelErasureForm erasureId={open.id} dossierId={dossierId} />
            </div>
          ) : (
            <div className="border-border mt-3 flex flex-col gap-3 border-t pt-3">
              <Alert tone="warning">
                Demande approuvée. L’exécution supprime définitivement les données concernées et les fichiers associés.
              </Alert>
              <ExecuteErasureForm erasureId={open.id} dossierId={dossierId} />
              <CancelErasureForm erasureId={open.id} dossierId={dossierId} />
            </div>
          )}
        </div>
      ) : isErasableScope(scope) ? (
        <div className="border-border rounded-lg border p-4">
          <p className="text-sm">
            Ce dossier est éligible : <strong>{ERASURE_SCOPE_LABELS[scope]}</strong>.
          </p>
          <p className="text-muted mt-1 mb-3 text-xs">{ERASURE_SCOPE_KEPT[scope]}</p>
          <RequestErasureForm dossierId={dossierId} />
        </div>
      ) : (
        <Alert tone="info">Ce dossier n’est pas encore éligible : aucune durée de conservation n’est atteinte.</Alert>
      )}

      {history.length > 0 && (
        <div className="border-border border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Historique</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={erasureStatusTone(e.status)}>{ERASURE_STATUS_LABELS[e.status]}</Badge>
                <span className="text-muted text-xs">
                  {e.status === "executed"
                    ? `Le ${formatDateTime(e.executed_at ?? e.requested_at)} par ${staffName(e.executed_by) ?? "—"}${
                        e.client_anonymised ? " · identité du client anonymisée" : ""
                      }`
                    : `Annulée le ${formatDateTime(e.cancelled_at ?? e.requested_at)} par ${staffName(e.cancelled_by) ?? "—"}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
