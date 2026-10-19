import { STAGE_LABELS, STAGES } from "@/lib/dossiers/labels";
import type { DossierStage } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** Bandeau des 7 étapes du dossier (docs/14_ecrans_ux.md) : étapes passées, en cours, à venir. */
export function StageBanner({ stage }: { stage: DossierStage }) {
  const current = STAGES.indexOf(stage);
  return (
    <nav aria-label="Étapes du dossier" className="relative overflow-x-auto">
      <ol className="flex min-w-max gap-1">
        {STAGES.map((s, index) => {
          const state = index < current ? "done" : index === current ? "current" : "todo";
          return (
            <li
              key={s}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
                state === "done" && "border-success/40 bg-success/10 text-success",
                state === "current" && "border-primary bg-primary text-primary-foreground",
                state === "todo" && "border-border text-muted",
              )}
            >
              <span className="sr-only">
                {state === "done"
                  ? "Étape terminée : "
                  : state === "current"
                    ? "Étape en cours : "
                    : "Étape à venir : "}
              </span>
              {index + 1}. {STAGE_LABELS[s]}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
