import type { Metadata } from "next";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, SCREEN_ROLES } from "@/lib/auth/roles";
import { formatDateTime, formatXof } from "@/lib/format";
import { usdCentsToXof } from "@/lib/money/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FxRateForm } from "./fx-form";

export const metadata: Metadata = { title: "Finances" };

/** Écran Finances — lot 3a : taux de change (US-3.5, R1). Soldes, échéances et remboursements : lots suivants. */
export default async function FinancesPage() {
  const access = await requireInternal(SCREEN_ROLES.finances);
  const canWrite = canAccess(access.role, SCREEN_ROLES.fxWrite);
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10); // Africa/Dakar = UTC
  const [{ data: rates, error }, { data: hasToday }, { data: sourceSetting }, { data: staff }] = await Promise.all([
    supabase.from("fx_rates").select("*").order("captured_at", { ascending: false }).limit(60),
    supabase.rpc("fx_rate_exists_on", { p_day: today }),
    supabase.from("settings_current").select("value").eq("key", "fx.source").maybeSingle(),
    supabase.from("staff_directory").select("id, full_name"),
  ]);
  const current = rates?.[0];
  const staffName = (id: string | null) => staff?.find((s) => s.id === id)?.full_name ?? "—";
  const defaultSource = typeof sourceSetting?.value === "string" ? sourceSetting.value : "XE.com";

  return (
    <>
      <PageHeader
        title="Finances"
        description="Taux de change USD → FCFA : le devis fige le taux du jour de son émission ; chaque paiement prend le taux du jour du paiement (R1)."
      />
      <div className="flex flex-col gap-6">
        {!hasToday && (
          <Alert tone="warning">
            Aucun taux relevé aujourd’hui : enregistrez-le avant de saisir un paiement ou d’émettre un devis.
          </Alert>
        )}

        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">Taux en vigueur</h2>
          {current ? (
            <>
              <p className="amount text-2xl font-semibold">
                1 $US = {current.rate.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
                FCFA
              </p>
              <p className="text-muted text-sm">
                {current.source} · relevé le {formatDateTime(current.captured_at)} · exemple : 10 000 $US ={" "}
                {formatXof(usdCentsToXof(1_000_000, String(current.rate)))}
              </p>
            </>
          ) : (
            <EmptyState title="Aucun taux enregistré" />
          )}
        </Card>

        {canWrite && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">Relever le taux du jour</h2>
            <FxRateForm defaultSource={defaultSource} now={new Date().toISOString().slice(0, 16)} />
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Historique des taux</h2>
          {error ? (
            <Alert tone="danger">L’historique n’a pas pu être chargé. Rechargez la page.</Alert>
          ) : !rates?.length ? (
            <EmptyState title="Aucun relevé" />
          ) : (
            <Table caption="Historique des taux de change">
              <thead>
                <tr>
                  <Th>Relevé le</Th>
                  <Th>Taux</Th>
                  <Th className="hidden sm:table-cell">Source</Th>
                  <Th className="hidden md:table-cell">Saisi par</Th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(r.captured_at)}</Td>
                    <Td className="amount">
                      {r.rate.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </Td>
                    <Td className="hidden sm:table-cell">{r.source}</Td>
                    <Td className="hidden md:table-cell">{staffName(r.created_by)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
