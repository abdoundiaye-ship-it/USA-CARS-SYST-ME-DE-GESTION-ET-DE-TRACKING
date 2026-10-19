import type { Metadata, Route } from "next";
import Link from "next/link";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, SCREEN_ROLES } from "@/lib/auth/roles";
import { CONTAINER_STATUS_LABELS } from "@/lib/dossiers/labels";
import { formatDate } from "@/lib/format";
import { maxDaysWithoutCheck } from "@/lib/server/tracking-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { arrivalLabel, trackingCheckOverdue } from "@/lib/tracking";

export const metadata: Metadata = { title: "Conteneurs" };

export default async function ConteneursPage({ searchParams }: PageProps<"/conteneurs">) {
  const access = await requireInternal(SCREEN_ROLES.containers);
  const canWrite = canAccess(access.role, SCREEN_ROLES.operationsWrite);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("containers")
    .select("*, carriers(name, link_type)")
    .order("ata", { ascending: true, nullsFirst: true })
    .order("eta", { ascending: true, nullsFirst: false })
    .limit(200);
  if (q) {
    const p = `%${q.replace(/[\\%_,()]/g, " ").trim()}%`;
    query = query.or(`number.ilike.${p},bl_number.ilike.${p},vessel.ilike.${p}`);
  }
  const [{ data: containers, error }, { data: assignments }, maxDays] = await Promise.all([
    query,
    supabase.from("dossier_containers").select("container_id").is("removed_at", null),
    maxDaysWithoutCheck(),
  ]);
  const vehicleCount = (id: string) => assignments?.filter((a) => a.container_id === id).length ?? 0;

  return (
    <>
      <PageHeader
        title="Conteneurs"
        description="Références d’expédition, ETA indicative et suivi. L’ETA n’est pas une position en temps réel."
      >
        {canWrite && (
          <Link
            href="/conteneurs/nouveau"
            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
          >
            Nouveau conteneur
          </Link>
        )}
      </PageHeader>

      <form role="search" className="mb-4 flex flex-col gap-2 sm:flex-row" action="/conteneurs">
        <label htmlFor="q" className="sr-only">
          Rechercher un conteneur
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder="Numéro, B/L ou navire" className="sm:max-w-sm" />
        <button
          type="submit"
          className="border-border bg-card hover:bg-background min-h-10 rounded-md border px-4 py-2 text-sm font-medium"
        >
          Rechercher
        </button>
      </form>

      {error ? (
        <Alert tone="danger">La liste des conteneurs n’a pas pu être chargée. Rechargez la page.</Alert>
      ) : !containers?.length ? (
        <EmptyState title={q ? "Aucun conteneur trouvé" : "Aucun conteneur"}>
          {q ? "Vérifiez le numéro saisi." : canWrite && "Créez le premier conteneur."}
        </EmptyState>
      ) : (
        <Table caption="Conteneurs">
          <thead>
            <tr>
              <Th>Conteneur</Th>
              <Th className="hidden sm:table-cell">Transporteur · navire</Th>
              <Th>Statut</Th>
              <Th>Arrivée</Th>
              <Th className="hidden md:table-cell">Véhicules</Th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => {
              const overdue = trackingCheckOverdue(c, maxDays);
              return (
                <tr key={c.id}>
                  <Td>
                    <Link
                      href={`/conteneurs/${c.id}` as Route}
                      className="text-primary font-mono font-medium underline-offset-2 hover:underline"
                    >
                      {c.number}
                    </Link>
                    {c.bl_number && <p className="text-muted text-xs">B/L {c.bl_number}</p>}
                  </Td>
                  <Td className="hidden sm:table-cell">
                    {c.carriers?.name ?? "—"}
                    {(c.vessel || c.voyage) && (
                      <p className="text-muted text-xs">{[c.vessel, c.voyage].filter(Boolean).join(" · ")}</p>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={c.ata ? "success" : "info"}>{CONTAINER_STATUS_LABELS[c.status]}</Badge>
                    {overdue && (
                      <p className="text-warning mt-1 text-xs font-medium">À vérifier (suivi non consulté)</p>
                    )}
                  </Td>
                  <Td>{arrivalLabel(c)}</Td>
                  <Td className="hidden md:table-cell">{vehicleCount(c.id)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <p className="text-muted mt-3 text-xs">
        Dernière vérification au-delà de {Number.isFinite(maxDays) ? `${maxDays} jours` : "la limite"} pour un conteneur
        en mer : signalé « À vérifier ». Liste mise à jour le {formatDate(new Date())}.
      </p>
    </>
  );
}
