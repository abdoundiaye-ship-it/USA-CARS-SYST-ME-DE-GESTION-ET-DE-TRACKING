import { AppNav, type NavItem } from "@/components/app-nav";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, ROLE_LABELS, SCREEN_ROLES } from "@/lib/auth/roles";
import { signOut } from "../connexion/actions";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const access = await requireInternal();

  const items: NavItem[] = [
    { href: "/tableau-de-bord", label: "Tableau de bord" },
    { href: "/dossiers", label: "Dossiers" },
    { href: "/clients", label: "Clients" },
    ...(canAccess(access.role, SCREEN_ROLES.users) ? [{ href: "/utilisateurs" as const, label: "Utilisateurs" }] : []),
    { href: "/parametres", label: "Paramètres" },
    ...(canAccess(access.role, SCREEN_ROLES.audit) ? [{ href: "/audit" as const, label: "Journal d’audit" }] : []),
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-primary font-semibold">USA CARS</p>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <p className="min-w-0 truncate text-right">
              <span className="font-medium">{access.fullName}</span>
              <span className="text-muted hidden sm:inline"> · {ROLE_LABELS[access.role]}</span>
            </p>
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 md:flex-row md:py-8">
        <aside className="md:w-52 md:shrink-0">
          <AppNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
