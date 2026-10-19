import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, SCREEN_ROLES } from "@/lib/auth/roles";
import { CLIENT_KIND_LABELS, ID_DOCUMENT_LABELS, STAGE_LABELS } from "@/lib/dossiers/labels";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missingClientInformation } from "@/lib/validation/operations";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Fiche client" };

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const access = await requireInternal(SCREEN_ROLES.clients);
  const canWrite = canAccess(access.role, SCREEN_ROLES.operationsWrite);
  const { id } = await params;
  const created = (await searchParams).cree === "1";

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();
  const { data: dossiers, error } = await supabase
    .from("dossiers")
    .select("id, reference, stage, status, make, model, model_year, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const { data: statuses } = await supabase.from("workflow_statuses").select("stage, code, label");
  const statusLabel = (stage: string, code: string) =>
    statuses?.find((s) => s.stage === stage && s.code === code)?.label ?? code;
  const missing = missingClientInformation(client);

  return (
    <>
      <PageHeader title={client.name} description={`${CLIENT_KIND_LABELS[client.kind]} · ${client.notify_phone}`}>
        {canWrite && (
          <Link
            href={`/dossiers/nouveau?client=${client.id}` as Route}
            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
          >
            Ouvrir un dossier
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-col gap-6">
        {created && <Alert tone="success">Fiche client créée.</Alert>}
        {missing.length > 0 && (
          <Alert tone="warning">Fiche à compléter avant de passer à l’étape Achat : {missing.join(", ")}.</Alert>
        )}

        <Card>
          <h2 className="mb-4 font-semibold">Dossiers du client</h2>
          {error ? (
            <Alert tone="danger">Les dossiers n’ont pas pu être chargés. Rechargez la page.</Alert>
          ) : !dossiers?.length ? (
            <EmptyState title="Aucun dossier">
              Un dossier correspond à un véhicule (un contrat par véhicule).
            </EmptyState>
          ) : (
            <Table caption="Dossiers du client">
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Véhicule</Th>
                  <Th>Étape · statut</Th>
                  <Th className="hidden sm:table-cell">Ouvert le</Th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => (
                  <tr key={d.id}>
                    <Td>
                      <Link
                        href={`/dossiers/${d.id}` as Route}
                        className="text-primary font-medium whitespace-nowrap underline-offset-2 hover:underline"
                      >
                        {d.reference}
                      </Link>
                    </Td>
                    <Td>{[d.make, d.model, d.model_year].filter(Boolean).join(" ") || "—"}</Td>
                    <Td>
                      <Badge tone="info">{STAGE_LABELS[d.stage]}</Badge>{" "}
                      <span className="text-muted text-xs">{statusLabel(d.stage, d.status)}</span>
                    </Td>
                    <Td className="hidden sm:table-cell">{formatDate(d.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">{canWrite ? "Modifier la fiche" : "Informations"}</h2>
          {canWrite ? (
            <ClientForm client={client} />
          ) : (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">E-mail</dt>
                <dd>{client.notify_email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Adresse</dt>
                <dd>{client.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Pièce d’identité</dt>
                <dd>
                  {client.id_document_type
                    ? `${ID_DOCUMENT_LABELS[client.id_document_type]} ${client.id_document_number ?? ""}`
                    : "—"}
                </dd>
              </div>
              {client.kind === "company" && (
                <div>
                  <dt className="text-muted">NINEA / RCCM</dt>
                  <dd>{[client.ninea, client.rccm].filter(Boolean).join(" · ") || "—"}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>
      </div>
    </>
  );
}
