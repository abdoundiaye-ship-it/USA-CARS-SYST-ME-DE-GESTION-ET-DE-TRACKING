import type { Metadata, Route } from "next";
import Link from "next/link";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  confirmationProgress,
  matchesStatusFilter,
  parseStatusFilter,
  STATUS_FILTER_LABELS,
  type StatusFilter,
} from "@/lib/settings/confirmation";
import { groupLabel, settingLabel } from "@/lib/settings/labels";
import { formatSettingValue } from "@/lib/settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres contractuels" };

const FILTERS: StatusFilter[] = ["a_confirmer", "confirme", "tous"];

export default async function ParametresPage({ searchParams }: PageProps<"/parametres">) {
  const access = await requireInternal(SCREEN_ROLES.settings);
  const isAdmin = access.role === "admin";
  const filter = parseStatusFilter((await searchParams).statut);

  const supabase = await createSupabaseServerClient();
  const { data: settings, error } = await supabase.from("settings_current").select("*").order("key");

  // Traçabilité (P6-4) : administrateur et heure d'enregistrement de la version en vigueur.
  const authorIds = [...new Set((settings ?? []).map((s) => s.created_by).filter((id): id is string => !!id))];
  const authors = new Map<string, string>();
  if (authorIds.length) {
    const { data } = await supabase.from("staff_directory").select("id, full_name").in("id", authorIds);
    for (const p of data ?? []) authors.set(p.id, p.full_name);
  }
  const authorName = (id: string | null) =>
    id ? (authors.get(id) ?? "Utilisateur interne") : "Chargement initial (migration)";

  const progress = confirmationProgress((settings ?? []).map((s) => s.status));
  const percent = progress.total ? Math.round((progress.confirmed / progress.total) * 100) : 0;

  const groups = new Map<string, NonNullable<typeof settings>>();
  for (const s of settings ?? []) {
    if (!matchesStatusFilter(s.status, filter)) continue;
    const label = groupLabel(s.key);
    groups.set(label, [...(groups.get(label) ?? []), s]);
  }

  return (
    <>
      <PageHeader
        title="Paramètres contractuels"
        description={
          isAdmin
            ? "Valeurs appliquées par l’application (délais, montants, seuils). Une modification ou une validation crée une nouvelle version datée, appliquée aux dossiers ouverts à partir de sa date d’effet."
            : "Valeurs appliquées par l’application (consultation)."
        }
      >
        <div className="flex flex-col gap-1 sm:items-end">
          <Link href="/parametres/transporteurs" className="text-primary text-sm font-medium underline">
            Transporteurs et liens de suivi →
          </Link>
          <Link href="/parametres/comptes-officiels" className="text-primary text-sm font-medium underline">
            Comptes officiels de paiement →
          </Link>
          <Link href="/parametres/jours-feries" className="text-primary text-sm font-medium underline">
            Jours fériés (jours ouvrés) →
          </Link>
        </div>
      </PageHeader>

      {!error && progress.total > 0 && (
        <section aria-labelledby="avancement" className="mb-6 flex flex-col gap-2">
          <h2 id="avancement" className="text-sm font-semibold">
            Validation avant la mise en production
          </h2>
          <div
            role="progressbar"
            aria-label="Paramètres confirmés"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.confirmed}
            className="bg-border h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-success h-full rounded-full" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-sm font-medium">
            {progress.confirmed} confirmés sur {progress.total} ·{" "}
            {progress.toConfirm === 0
              ? "tous les paramètres sont confirmés."
              : `${progress.toConfirm} paramètre${progress.toConfirm > 1 ? "s" : ""} encore à confirmer`}
          </p>
          {progress.toConfirm > 0 && (
            <Alert tone="warning">
              Valeurs provisoires à vérifier et valider avant la mise en production
              {isAdmin ? " : ouvrez chaque paramètre « À confirmer » pour le valider ou le modifier." : "."}
            </Alert>
          )}
        </section>
      )}

      <nav aria-label="Filtrer par statut" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={(f === "tous" ? "/parametres" : `/parametres?statut=${f}`) as Route}
            aria-current={f === filter ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              f === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-background"
            }`}
          >
            {STATUS_FILTER_LABELS[f]}
            {f === "a_confirmer" && ` (${progress.toConfirm})`}
          </Link>
        ))}
      </nav>

      {error ? (
        <Alert tone="danger">Les paramètres n’ont pas pu être chargés. Rechargez la page.</Alert>
      ) : progress.total === 0 ? (
        <EmptyState title="Aucun paramètre">Le chargement initial n’a pas été appliqué à cette base.</EmptyState>
      ) : groups.size === 0 ? (
        <EmptyState title={filter === "a_confirmer" ? "Aucun paramètre à confirmer" : "Aucun paramètre confirmé"}>
          {filter === "a_confirmer" ? "Tous les paramètres ont été validés." : "Aucun paramètre n’a encore été validé."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {[...groups.entries()].map(([group, items]) => (
            <section key={group} aria-labelledby={`groupe-${group}`}>
              <h2 id={`groupe-${group}`} className="mb-2 font-semibold">
                {group}
              </h2>
              <Table caption={group}>
                <thead>
                  <tr>
                    <Th>Paramètre</Th>
                    <Th>Valeur</Th>
                    <Th>Statut</Th>
                    <Th className="hidden sm:table-cell">En vigueur depuis</Th>
                    <Th className="hidden md:table-cell">Enregistré le / par</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => {
                    const href = `/parametres/${encodeURIComponent(s.key)}` as Route;
                    return (
                      <tr key={s.key}>
                        <Td>
                          <Link href={href} className="text-primary font-medium underline-offset-2 hover:underline">
                            {settingLabel(s.key)}
                          </Link>
                          <p className="text-muted font-mono text-xs break-all">{s.key}</p>
                        </Td>
                        <Td className="amount">{formatSettingValue(s.value_type, s.value)}</Td>
                        <Td>
                          {s.status === "a_confirmer" ? (
                            <div className="flex flex-col items-start gap-1">
                              <Badge tone="warning">À confirmer</Badge>
                              {isAdmin && (
                                <Link href={href} className="text-primary text-xs underline">
                                  Vérifier et valider
                                </Link>
                              )}
                            </div>
                          ) : (
                            <Badge tone="success">Confirmé</Badge>
                          )}
                        </Td>
                        <Td className="hidden sm:table-cell">{formatDate(s.effective_from)}</Td>
                        <Td className="hidden text-xs md:table-cell">
                          {formatDateTime(s.created_at)}
                          <br />
                          <span className="text-muted">{authorName(s.created_by)}</span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
