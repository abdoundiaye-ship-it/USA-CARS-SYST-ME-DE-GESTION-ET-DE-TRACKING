import type { Metadata, Route } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, SCREEN_ROLES } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TEMPLATE_LABELS,
} from "@/lib/notifications/labels";
import type { NotificationStatus } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DispatchNowButton, RetryNotificationButton, TestNotificationButton } from "./notification-forms";

export const metadata: Metadata = { title: "Notifications" };

const STATUS_TONES: Record<NotificationStatus, "success" | "danger" | "warning" | "info" | "neutral"> = {
  queued: "warning",
  sending: "info",
  sent: "success",
  simulated: "neutral",
  failed: "danger",
};

const FILTERS = ["failed", "queued", "sent", "simulated"] as const;

/**
 * US-4.5 : journal des notifications (e-mail et WhatsApp) avec statut, erreur et renvoi. Les messages ne
 * contiennent jamais de coordonnées de paiement ; le lien de connexion d'un client est masqué une fois envoyé.
 */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const access = await requireInternal(SCREEN_ROLES.notifications);
  const canWrite = canAccess(access.role, SCREEN_ROLES.notificationsWrite);
  const canTest = canAccess(access.role, SCREEN_ROLES.notificationsTest);
  const params = await searchParams;
  const filter = FILTERS.find((f) => f === params.statut) ?? null;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("notifications")
    .select("*, dossiers(reference), clients(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("status", filter);
  const [{ data: notifications, error }, { count: failedCount }] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Messages envoyés aux clients par e-mail et WhatsApp : lot remporté, devis, échéances, départ, ETA, arrivée, documents."
      />
      <div className="flex flex-col gap-6">
        {(failedCount ?? 0) > 0 && (
          <Alert tone="danger">
            {failedCount} notification{(failedCount ?? 0) > 1 ? "s" : ""} en échec : vérifiez le destinataire et
            renvoyez-les.
          </Alert>
        )}
        {(canWrite || canTest) && (
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {canWrite && <DispatchNowButton />}
            {canTest && <TestNotificationButton />}
          </Card>
        )}
        <Card className="flex flex-col gap-4">
          <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-3 text-sm">
            <Link href={"/notifications" as Route} className={!filter ? "font-semibold" : "text-primary underline"}>
              Toutes
            </Link>
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={`/notifications?statut=${f}` as Route}
                className={filter === f ? "font-semibold" : "text-primary underline"}
              >
                {NOTIFICATION_STATUS_LABELS[f]}
              </Link>
            ))}
          </nav>
          {error ? (
            <Alert tone="danger">Le journal n’a pas pu être chargé. Rechargez la page.</Alert>
          ) : !notifications?.length ? (
            <EmptyState title="Aucune notification" />
          ) : (
            <Table caption="Journal des notifications (200 dernières)">
              <thead>
                <tr>
                  <Th>Message</Th>
                  <Th className="hidden sm:table-cell">Destinataire</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <Td>
                      {NOTIFICATION_TEMPLATE_LABELS[n.template]}
                      <p className="text-muted text-xs">
                        {NOTIFICATION_CHANNEL_LABELS[n.channel]} · {formatDateTime(n.created_at)}
                        {n.dossiers?.reference && ` · ${n.dossiers.reference}`}
                      </p>
                    </Td>
                    <Td className="hidden break-all sm:table-cell">
                      {n.clients?.name ?? "—"}
                      <p className="text-muted text-xs">
                        {n.recipient}
                        {n.redirected_to && ` → test : ${n.redirected_to}`}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONES[n.status]}>{NOTIFICATION_STATUS_LABELS[n.status]}</Badge>
                      {n.last_error && <p className="text-danger text-xs break-words">{n.last_error}</p>}
                      {n.status === "failed" && canWrite && <RetryNotificationButton id={n.id} />}
                    </Td>
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
