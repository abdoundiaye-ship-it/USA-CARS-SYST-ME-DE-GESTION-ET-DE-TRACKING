import { checkDatabaseHealth, type DatabaseHealth } from "@/lib/server/health";

export const dynamic = "force-dynamic";

const healthLabels: Record<DatabaseHealth, { text: string; className: string }> = {
  ok: { text: "Connexion à la base de données : opérationnelle", className: "text-success" },
  unreachable: { text: "Connexion à la base de données : injoignable", className: "text-danger" },
  not_configured: {
    text: "Connexion à la base de données : non configurée (voir .env.example)",
    className: "text-warning",
  },
};

export default async function HomePage() {
  const health = healthLabels[await checkDatabaseHealth()];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">USA CARS</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Système de gestion et de suivi des dossiers</h1>
        <p className="text-muted">
          Achat aux enchères aux États-Unis, transport et suivi jusqu’au port de Dakar. L’application est en cours de
          construction : les espaces interne et client ouvriront dans les prochaines phases.
        </p>
      </div>
      <p role="status" className={`border-border bg-card rounded-md border px-4 py-3 text-sm ${health.className}`}>
        {health.text}
      </p>
    </main>
  );
}
