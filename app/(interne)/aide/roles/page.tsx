import type { Metadata, Route } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { Badge, Card, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { requireInternal } from "@/lib/auth/access";
import { ROLE_LABELS, SCREEN_ROLES } from "@/lib/auth/roles";
import { STAGE_LABELS } from "@/lib/dossiers/labels";
import { formatDate } from "@/lib/format";
import {
  GOOD_PRACTICES,
  GUIDE_ROLES,
  GUIDE_UPDATED_AT,
  MODULE_AREAS,
  MODULES,
  modulesForRole,
  PRINCIPLES,
  PROFILES,
  RIGHT_CODES,
  RIGHT_LABELS,
  rightCodes,
  RIGHTS,
  VALIDATION_CIRCUITS,
  WORKFLOW,
} from "@/lib/help/roles-guide";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REPORTS } from "@/supabase/functions/_shared/reports.ts";

export const metadata: Metadata = { title: "Rôles et droits d’accès" };

const SECTIONS = [
  ["principes", "Principes de sécurité"],
  ["profils", "Les profils"],
  ["matrice", "Matrice des droits"],
  ["rapports", "Rapports par rôle"],
  ["validations", "Validations croisées"],
  ["processus", "Processus métier"],
  ["bonnes-pratiques", "Bonnes pratiques"],
] as const;

const INTERNAL_COLUMNS = GUIDE_ROLES.filter((r) => r !== "client");

/**
 * Décision P6-5 : guide des rôles, des droits d'accès et du circuit de validation, pour l'administrateur et la
 * direction (gestion des comptes, attribution des rôles, contrôle des accès). Imprimable.
 */
export default async function RolesGuidePage() {
  await requireInternal(SCREEN_ROLES.rolesGuide);

  // Rôles soumis à la double authentification : valeur en vigueur du paramètre (décisions A4 et A4-bis).
  const supabase = await createSupabaseServerClient();
  const { data: mfaSetting } = await supabase
    .from("settings_current")
    .select("value")
    .eq("key", "auth.mfa_required_roles")
    .maybeSingle();
  const mfaRoles = Array.isArray(mfaSetting?.value) ? (mfaSetting.value as string[]) : [];
  const authLabel = (role: string) =>
    role === "client"
      ? "Connexion par lien"
      : mfaRoles.includes(role)
        ? "Double authentification exigée"
        : "Double authentification non exigée";

  return (
    <>
      <p className="mb-2 text-sm print:hidden">
        <Link href={"/aide" as Route} className="text-primary underline underline-offset-2">
          ← Aide
        </Link>
      </p>
      <PageHeader
        title="Rôles et droits d’accès"
        description={`Guide de gouvernance pour l’administrateur et la direction : profils, droits, restrictions et circuit de validation. Version du ${formatDate(GUIDE_UPDATED_AT)}.`}
      >
        <PrintButton />
      </PageHeader>

      <nav aria-label="Sommaire" className="mb-8 flex flex-wrap gap-2 print:hidden">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="border-border bg-card hover:bg-background rounded-md border px-3 py-1.5 text-sm"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-10">
        <section id="principes" aria-labelledby="principes-titre" className="scroll-mt-20">
          <h2 id="principes-titre" className="mb-3 text-lg font-bold">
            Principes de sécurité et de gouvernance
          </h2>
          <Card>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
              {PRINCIPLES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="profils" aria-labelledby="profils-titre" className="scroll-mt-20">
          <h2 id="profils-titre" className="mb-3 text-lg font-bold">
            Les profils
          </h2>
          <div className="flex flex-col gap-4">
            {PROFILES.map((profile) => (
              <Card key={profile.role} className="flex flex-col gap-3 print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{ROLE_LABELS[profile.role]}</h3>
                  <Badge tone={profile.role === "client" ? "neutral" : "info"}>{authLabel(profile.role)}</Badge>
                </div>
                <p className="text-sm leading-relaxed">{profile.mission}</p>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Rôle et responsabilités</h4>
                    <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
                      {profile.responsibilities.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Modules accessibles et droits</h4>
                    <ul className="text-muted flex flex-col gap-1 text-sm">
                      {modulesForRole(profile.role).map(({ module, rights }) => (
                        <li key={module.id}>
                          <span className="text-foreground">{module.name}</span> :{" "}
                          {rights.map((r) => RIGHT_LABELS[r].toLowerCase()).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Restrictions et limites</h4>
                    <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
                      {profile.restrictions.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section id="matrice" aria-labelledby="matrice-titre" className="scroll-mt-20">
          <h2 id="matrice-titre" className="mb-1 text-lg font-bold">
            Matrice des droits
          </h2>
          <p className="text-muted mb-3 text-sm">
            {RIGHTS.map((r) => `${RIGHT_CODES[r]} = ${RIGHT_LABELS[r]}`).join(" · ")} · — = aucun accès. Les droits sont
            appliqués par la base ; le détail de chaque module suit le tableau.
          </p>
          <Table caption="Matrice des droits par module et par profil">
            <thead>
              <tr>
                <Th>Module</Th>
                {GUIDE_ROLES.map((role) => (
                  <Th key={role} className="whitespace-nowrap">
                    {ROLE_LABELS[role]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_AREAS.flatMap((area) => [
                <tr key={area}>
                  <Td colSpan={GUIDE_ROLES.length + 1} className="bg-background font-semibold">
                    {area}
                  </Td>
                </tr>,
                ...MODULES.filter((m) => m.area === area).map((module) => (
                  <tr key={module.id}>
                    <Td>{module.name}</Td>
                    {GUIDE_ROLES.map((role) => (
                      <Td key={role} className="font-mono text-xs whitespace-nowrap">
                        {rightCodes(module, role) || "—"}
                      </Td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </Table>

          <h3 className="mt-6 mb-3 font-semibold">Précisions, restrictions et limites par module</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {MODULE_AREAS.map((area) => (
              <Card key={area} className="flex flex-col gap-3 print:break-inside-avoid">
                <h4 className="font-semibold">{area}</h4>
                <dl className="flex flex-col gap-3 text-sm">
                  {MODULES.filter((m) => m.area === area && m.notes.length > 0).map((module) => (
                    <div key={module.id}>
                      <dt className="font-medium">{module.name}</dt>
                      <dd>
                        <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
                          {module.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </section>

        <section id="rapports" aria-labelledby="rapports-titre" className="scroll-mt-20">
          <h2 id="rapports-titre" className="mb-1 text-lg font-bold">
            Rapports par rôle
          </h2>
          <p className="text-muted mb-3 text-sm">Le client n’a accès à aucun rapport.</p>
          <Table caption="Rapports accessibles par rôle">
            <thead>
              <tr>
                <Th>Rapport</Th>
                {INTERNAL_COLUMNS.map((role) => (
                  <Th key={role} className="whitespace-nowrap">
                    {ROLE_LABELS[role]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(REPORTS).map(([key, report]) => (
                <tr key={key}>
                  <Td>{report.title}</Td>
                  {INTERNAL_COLUMNS.map((role) => (
                    <Td key={role}>{(report.roles as readonly string[]).includes(role) ? "Oui" : "—"}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section id="validations" aria-labelledby="validations-titre" className="scroll-mt-20">
          <h2 id="validations-titre" className="mb-3 text-lg font-bold">
            Validations croisées et séparation des tâches
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {VALIDATION_CIRCUITS.map((circuit) => (
              <Card key={circuit.name} className="flex flex-col gap-2 print:break-inside-avoid">
                <h3 className="font-semibold">{circuit.name}</h3>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                  {circuit.steps.map((step) => (
                    <li key={`${step.who}-${step.what}`}>
                      <strong>{step.who}</strong> {step.what}
                    </li>
                  ))}
                </ol>
                <p className="text-muted text-xs">{circuit.rule}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="processus" aria-labelledby="processus-titre" className="scroll-mt-20">
          <h2 id="processus-titre" className="mb-1 text-lg font-bold">
            Processus métier : qui fait quoi, étape par étape
          </h2>
          <p className="text-muted mb-3 text-sm">
            Un dossier = un véhicule, de l’ouverture à la clôture. L’administrateur peut agir à chaque étape.
          </p>
          <ol className="flex flex-col gap-3">
            {WORKFLOW.map((step, i) => (
              <li key={step.stage}>
                <Card className="flex flex-col gap-1 print:break-inside-avoid">
                  <h3 className="font-semibold">
                    {i + 1}. {STAGE_LABELS[step.stage]}
                  </h3>
                  <p className="text-sm">{step.what}</p>
                  <dl className="text-muted grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-foreground inline font-medium">Qui agit : </dt>
                      <dd className="inline">{step.who}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground inline font-medium">Qui valide : </dt>
                      <dd className="inline">{step.validates}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section id="bonnes-pratiques" aria-labelledby="bonnes-pratiques-titre" className="scroll-mt-20">
          <h2 id="bonnes-pratiques-titre" className="mb-3 text-lg font-bold">
            Bonnes pratiques pour gérer les comptes et les rôles
          </h2>
          <Card>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
              {GOOD_PRACTICES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm print:hidden">
              Les comptes se gèrent dans{" "}
              <Link href={"/utilisateurs" as Route} className="text-primary underline underline-offset-2">
                Utilisateurs
              </Link>{" "}
              ; la revue des accès se trouve dans{" "}
              <Link
                href={"/rapports?rapport=access_review" as Route}
                className="text-primary underline underline-offset-2"
              >
                Rapports → Revue des accès
              </Link>
              .
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}
