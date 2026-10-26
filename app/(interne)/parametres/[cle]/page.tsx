import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import {
  isPlaceholderValue,
  isUndefinedValue,
  SETTING_ACTION_LABELS,
  settingActionKind,
} from "@/lib/settings/confirmation";
import { groupLabel, settingLabel } from "@/lib/settings/labels";
import { formatSettingValue, settingValueToInput } from "@/lib/settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConfirmSettingForm, SettingForm } from "../setting-form";

type Version = { effective_from: string };

/** Version en vigueur (la plus récente déjà effective) et versions programmées. */
function classifyVersions<T extends Version>(versions: T[]): { current: T; future: Set<T> } {
  const now = Date.now();
  const future = new Set(versions.filter((v) => new Date(v.effective_from).getTime() > now));
  const current = versions.find((v) => !future.has(v)) ?? versions[versions.length - 1]!;
  return { current, future };
}

export async function generateMetadata({ params }: PageProps<"/parametres/[cle]">): Promise<Metadata> {
  const { cle } = await params;
  return { title: settingLabel(decodeURIComponent(cle)) };
}

export default async function ParametrePage({ params, searchParams }: PageProps<"/parametres/[cle]">) {
  const access = await requireInternal(SCREEN_ROLES.settings);
  const key = decodeURIComponent((await params).cle);
  const justConfirmed = (await searchParams).valide === "1";

  const supabase = await createSupabaseServerClient();
  const { data: versions, error } = await supabase
    .from("settings")
    .select("*")
    .eq("key", key)
    .order("effective_from", { ascending: false });
  if (error) {
    return <Alert tone="danger">Le paramètre n’a pas pu être chargé. Rechargez la page.</Alert>;
  }
  if (!versions?.length) notFound();

  const { current, future: futureVersions } = classifyVersions(versions);

  // Traçabilité (P6-4) : nom de l'administrateur auteur de chaque version, lisible par toute l'équipe interne.
  const authorIds = [...new Set(versions.map((v) => v.created_by).filter((id): id is string => !!id))];
  const authors = new Map<string, string>();
  if (authorIds.length) {
    const { data } = await supabase.from("staff_directory").select("id, full_name").in("id", authorIds);
    for (const p of data ?? []) authors.set(p.id, p.full_name);
  }
  const authorName = (id: string | null) =>
    id ? (authors.get(id) ?? "Utilisateur interne") : "Chargement initial (migration)";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/parametres" className="text-primary underline underline-offset-2">
          ← Paramètres
        </Link>
      </p>
      <PageHeader title={settingLabel(key)} description={`${groupLabel(key)} · ${key}`} />

      {justConfirmed && current.status === "confirme" && (
        <Alert tone="success" className="mb-6">
          Paramètre validé le {formatDateTime(current.created_at)} par {authorName(current.created_by)}. La validation
          est enregistrée dans l’historique ci-dessous.
        </Alert>
      )}

      <Card className="mb-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Valeur en vigueur</dt>
            <dd className="amount text-lg font-semibold">{formatSettingValue(current.value_type, current.value)}</dd>
          </div>
          <div>
            <dt className="text-muted">Statut</dt>
            <dd>
              {current.status === "a_confirmer" ? (
                <Badge tone="warning">À confirmer</Badge>
              ) : (
                <Badge tone="success">Confirmé</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Version en vigueur enregistrée le</dt>
            <dd>
              {formatDateTime(current.created_at)} · {authorName(current.created_by)}
            </dd>
          </div>
        </dl>
      </Card>

      {access.role === "admin" && current.status === "a_confirmer" && (
        <Card className="mb-6">
          <h2 className="mb-1 font-semibold">Valider la valeur actuelle</h2>
          <p className="text-muted mb-4 text-sm">
            Vérifiez la valeur, puis validez-la : elle passe au statut « Confirmé ». La validation est enregistrée avec
            votre nom, la date et l’heure.
          </p>
          <ConfirmSettingForm
            settingKey={key}
            displayValue={formatSettingValue(current.value_type, current.value)}
            placeholder={isPlaceholderValue(current.value)}
            undefinedValue={isUndefinedValue(current.value)}
          />
        </Card>
      )}

      {access.role === "admin" && (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold">Modifier la valeur</h2>
          <SettingForm
            settingKey={key}
            valueType={current.value_type}
            currentInput={settingValueToInput(current.value_type, current.value)}
            currentStatus={current.status}
          />
        </Card>
      )}

      <h2 className="mb-2 font-semibold">Historique des versions</h2>
      <Table caption={`Historique de ${settingLabel(key)}`}>
        <thead>
          <tr>
            <Th>Action</Th>
            <Th>Enregistrée le</Th>
            <Th>Par</Th>
            <Th>Valeur</Th>
            <Th>Statut</Th>
            <Th>Date d’effet</Th>
            <Th>Motif / source</Th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, i) => {
            const future = futureVersions.has(v);
            const kind = settingActionKind(v, versions[i + 1] ?? null);
            return (
              <tr key={v.effective_from}>
                <Td>
                  <Badge tone={kind === "validation" ? "success" : kind === "modification" ? "info" : "neutral"}>
                    {SETTING_ACTION_LABELS[kind]}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">{formatDateTime(v.created_at)}</Td>
                <Td>{authorName(v.created_by)}</Td>
                <Td className="amount">{formatSettingValue(v.value_type, v.value)}</Td>
                <Td>{v.status === "a_confirmer" ? "À confirmer" : "Confirmé"}</Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(v.effective_from)}
                  {future && (
                    <Badge tone="info" className="ml-2">
                      Programmée
                    </Badge>
                  )}
                  {v === current && (
                    <Badge tone="success" className="ml-2">
                      En vigueur
                    </Badge>
                  )}
                </Td>
                <Td>{v.reason ?? v.source ?? "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
