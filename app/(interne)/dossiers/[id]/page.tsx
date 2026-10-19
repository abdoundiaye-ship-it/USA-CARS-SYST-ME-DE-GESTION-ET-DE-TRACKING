import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StageBanner } from "@/components/stage-banner";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, SCREEN_ROLES } from "@/lib/auth/roles";
import { CONTRACT_STATUS_LABELS, PLATFORM_LABELS, STAGE_LABELS, VEHICLE_CATEGORY_LABELS } from "@/lib/dossiers/labels";
import { formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missingClientInformation } from "@/lib/validation/operations";
import { DuplicateDossierForm, AcceptanceForm, RegenerateContractForm, VehicleForm } from "../dossier-forms";
import {
  AcceptanceSummary,
  AuctionSection,
  ConfirmationsSection,
  ContainerSection,
  DocumentsSection,
  downloadHref,
  PurchaseOrderSection,
  StageSection,
  type AgeCheck,
} from "./sections";

export const metadata: Metadata = { title: "Fiche dossier" };

const NOTICES: Record<string, { tone: "success" | "danger"; text: string }> = {
  ouvert: { tone: "success", text: "Dossier ouvert et contrat généré. Téléchargez-le pour le faire signer." },
  duplique: {
    tone: "success",
    text: "Dossier dupliqué : nouveau dossier pour le même client, avec son propre contrat.",
  },
  "contrat-erreur": {
    tone: "danger",
    text: "Le dossier est ouvert, mais le contrat n’a pas pu être généré. Utilisez « Générer le contrat » ci-dessous.",
  },
};

export default async function DossierPage({ params, searchParams }: PageProps<"/dossiers/[id]">) {
  const access = await requireInternal(SCREEN_ROLES.dossiers);
  const canWrite = canAccess(access.role, SCREEN_ROLES.operationsWrite);
  const isAdmin = access.role === "admin";
  const canConfirm = canAccess(access.role, ["admin", "ops", "accounting"]);
  const { id } = await params;
  const query = await searchParams;
  const notice =
    query.ouvert === "1"
      ? NOTICES.ouvert
      : query.duplique === "1"
        ? NOTICES.duplique
        : query.contrat === "erreur"
          ? NOTICES["contrat-erreur"]
          : null;

  const supabase = await createSupabaseServerClient();
  const { data: dossier } = await supabase.from("dossiers").select("*").eq("id", id).maybeSingle();
  if (!dossier) notFound();

  const [
    { data: client },
    { data: contract },
    { data: order },
    { data: acceptances },
    { data: events, error: eventsError },
    { data: statuses },
    { data: staff },
    { data: conditions },
    { data: ageRows },
    { data: confirmations },
    { data: documents },
    { data: containerAssignments },
    { data: openContainers },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", dossier.client_id).maybeSingle(),
    supabase
      .from("contracts")
      .select("*, documents!contracts_document_id_fkey(version, uploaded_at)")
      .eq("dossier_id", id)
      .maybeSingle(),
    supabase.from("purchase_orders").select("*").eq("dossier_id", id).maybeSingle(),
    supabase.from("acceptances").select("*").eq("dossier_id", id),
    supabase
      .from("dossier_events")
      .select("*")
      .eq("dossier_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("workflow_statuses")
      .select("stage, code, label, position")
      .eq("stage", dossier.stage)
      .order("position"),
    supabase.from("staff_directory").select("id, full_name"),
    supabase.rpc("stage_conditions", { p_dossier_id: id }),
    supabase.rpc("vehicle_age_check", { p_dossier_id: id }),
    supabase.from("dossier_confirmations").select("*").eq("dossier_id", id),
    supabase.from("documents").select("*").eq("dossier_id", id).order("uploaded_at", { ascending: false }),
    supabase
      .from("dossier_containers")
      .select("container_id, assigned_at, removed_at, removal_reason, containers(number, eta, ata, status)")
      .eq("dossier_id", id)
      .order("assigned_at", { ascending: false }),
    supabase.from("containers").select("id, number, eta").is("ata", null).order("number"),
  ]);
  const contractAcceptance = acceptances?.find((a) => a.subject === "contract") ?? null;
  const orderAcceptance = acceptances?.find((a) => a.subject === "purchase_order") ?? null;

  const statusLabel = statuses?.find((s) => s.code === dossier.status)?.label ?? dossier.status;
  const staffName = (userId: string | null) => staff?.find((s) => s.id === userId)?.full_name ?? null;
  const missing = client ? missingClientInformation(client) : [];
  const vehicle = [dossier.make, dossier.model, dossier.model_year].filter(Boolean).join(" ");
  const today = new Date().toISOString().slice(0, 10); // Africa/Dakar = UTC+0
  const ageCheck = (ageRows?.[0] ?? null) as AgeCheck | null;

  return (
    <>
      <PageHeader
        title={`Dossier ${dossier.reference}`}
        description={[vehicle || "Véhicule à préciser", client?.name].filter(Boolean).join(" · ")}
      />

      <div className="flex flex-col gap-6">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        <Card className="flex flex-col gap-3">
          <StageBanner stage={dossier.stage} />
          <p className="text-sm">
            Étape <strong>{STAGE_LABELS[dossier.stage]}</strong> · statut <Badge tone="info">{statusLabel}</Badge>
          </p>
          <dl className="text-muted grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div>
              <dt className="inline">Client : </dt>
              <dd className="inline">
                {client ? (
                  <Link href={`/clients/${client.id}` as Route} className="text-primary underline">
                    {client.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="inline">Responsable : </dt>
              <dd className="inline">{staffName(dossier.owner_id) ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline">Ouvert le : </dt>
              <dd className="inline">{formatDate(dossier.created_at)}</dd>
            </div>
          </dl>
          {missing.length > 0 && <Alert tone="warning">Fiche client à compléter : {missing.join(", ")}.</Alert>}
        </Card>

        <StageSection
          dossier={dossier}
          conditions={conditions ?? []}
          statuses={statuses ?? []}
          canWrite={canWrite}
          isAdmin={isAdmin}
        />

        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Contrat de prestation</h2>
          {!contract ? (
            <>
              <EmptyState title="Contrat non généré">
                Un contrat par véhicule, généré à l’ouverture du dossier.
              </EmptyState>
              {canWrite && <RegenerateContractForm dossierId={dossier.id} label="Générer le contrat" />}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <Badge
                    tone={
                      contract.status === "accepted" ? "success" : contract.status === "refused" ? "danger" : "warning"
                    }
                  >
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </Badge>{" "}
                  <span className="text-muted">
                    Référence {contract.reference} · version {contract.documents?.version ?? 1}
                    {contract.documents?.uploaded_at && ` du ${formatDateTime(contract.documents.uploaded_at)}`}
                  </span>
                </p>
                <a
                  href={downloadHref(contract.document_id)}
                  className="border-border bg-card hover:bg-background inline-flex min-h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Télécharger le contrat (Word)
                </a>
              </div>
              <p className="text-muted text-xs break-all">
                Empreinte SHA-256 de la version en vigueur :{" "}
                <span className="font-mono">{contract.document_sha256}</span>
              </p>

              {contractAcceptance ? (
                <AcceptanceSummary acceptance={contractAcceptance} staffName={staffName} />
              ) : canWrite ? (
                <>
                  <RegenerateContractForm dossierId={dossier.id} label="Régénérer le contrat" />
                  <div className="border-border border-t pt-4">
                    <h3 className="mb-3 font-medium">Enregistrer la décision du client</h3>
                    <AcceptanceForm dossierId={dossier.id} subject="contract" subjectId={contract.id} today={today} />
                  </div>
                </>
              ) : (
                <p className="text-muted text-sm">En attente de la décision du client.</p>
              )}
            </>
          )}
        </Card>

        <PurchaseOrderSection
          dossier={dossier}
          order={order}
          acceptance={orderAcceptance}
          ageCheck={ageCheck}
          canWrite={canWrite}
          isAdmin={isAdmin}
          today={today}
          staffName={staffName}
        />

        <AuctionSection dossier={dossier} order={order} canWrite={canWrite} isAdmin={isAdmin} staffName={staffName} />

        <ContainerSection
          dossier={dossier}
          assignments={containerAssignments ?? []}
          options={openContainers ?? []}
          canWrite={canWrite}
        />

        <ConfirmationsSection
          dossier={dossier}
          confirmations={confirmations ?? []}
          canConfirm={canConfirm}
          staffName={staffName}
        />

        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Véhicule</h2>
          {canWrite ? (
            <VehicleForm dossier={dossier} />
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {[
                ["Plateforme", dossier.platform ? PLATFORM_LABELS[dossier.platform] : null],
                ["N° de lot", dossier.lot_number],
                ["VIN", dossier.vin],
                ["Véhicule", vehicle],
                ["Kilométrage", dossier.mileage === null ? null : `${formatInteger(dossier.mileage)} miles`],
                ["Catégorie", dossier.vehicle_category ? VEHICLE_CATEGORY_LABELS[dossier.vehicle_category] : null],
                ["Statut du titre", dossier.title_status],
                ["Lieu d’achat", dossier.purchase_location],
                ["Port de départ", dossier.departure_port],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <DocumentsSection dossierId={dossier.id} documents={documents ?? []} canWrite={canWrite} />

        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Chronologie</h2>
          {eventsError ? (
            <Alert tone="danger">La chronologie n’a pas pu être chargée. Rechargez la page.</Alert>
          ) : !events?.length ? (
            <EmptyState title="Aucun événement" />
          ) : (
            <ol className="flex flex-col gap-3">
              {events.map((e) => (
                <li key={e.id} className="border-border border-l-2 pl-3 text-sm">
                  <p className="font-medium">{e.label}</p>
                  <p className="text-muted text-xs">
                    {formatDateTime(e.occurred_at)}
                    {staffName(e.actor_id) && ` · ${staffName(e.actor_id)}`}
                    {e.visible_client ? " · visible du client" : " · interne"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {canWrite && (
          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Autre véhicule pour ce client</h2>
            <p className="text-muted text-sm">
              Crée un nouveau dossier (et son propre contrat) en reprenant le client, la plateforme et le responsable —
              jamais le véhicule, les montants ni les documents signés.
            </p>
            <DuplicateDossierForm dossierId={dossier.id} />
          </Card>
        )}
      </div>
    </>
  );
}
