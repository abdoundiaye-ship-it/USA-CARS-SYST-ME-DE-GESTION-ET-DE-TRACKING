import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/feedback";
import { requireInternal } from "@/lib/auth/access";
import { canAccess, ROLE_LABELS, SCREEN_ROLES } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBordPage() {
  const access = await requireInternal(SCREEN_ROLES.dashboard);

  return (
    <>
      <PageHeader
        title={`Bonjour ${access.fullName}`}
        description={`Connecté en tant que : ${ROLE_LABELS[access.role]}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Dossiers, conteneurs et finances</h2>
          <p className="text-muted mt-1 text-sm">
            Les dossiers véhicules, le suivi des conteneurs et les finances arrivent dans les prochaines phases. Cet
            écran affichera alors les indicateurs et la liste « À traiter ».
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">Raccourcis</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {canAccess(access.role, SCREEN_ROLES.users) && (
              <li>
                <Link href="/utilisateurs" className="text-primary underline underline-offset-2">
                  Gérer les utilisateurs
                </Link>
              </li>
            )}
            <li>
              <Link href="/parametres" className="text-primary underline underline-offset-2">
                Consulter les paramètres contractuels
              </Link>
            </li>
            {canAccess(access.role, SCREEN_ROLES.audit) && (
              <li>
                <Link href="/audit" className="text-primary underline underline-offset-2">
                  Consulter le journal d’audit
                </Link>
              </li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
