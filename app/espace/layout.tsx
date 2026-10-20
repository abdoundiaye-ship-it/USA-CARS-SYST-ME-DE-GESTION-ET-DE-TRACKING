import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { requireClient } from "@/lib/auth/access";
import { signOut } from "../connexion/actions";

/** Portail client (phase 4) : espace distinct de l'espace interne ; données filtrées par la RLS (règle 3). */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const access = await requireClient();
  return (
    <div className="min-h-dvh">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/espace" aria-label="USA CARS — mes dossiers">
            <BrandLogo priority className="h-10" />
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <p className="min-w-0 truncate text-right font-medium">{access.fullName}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="border-border hover:bg-background rounded-md border px-3 py-1.5 whitespace-nowrap"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-4 md:py-8">{children}</main>
    </div>
  );
}
