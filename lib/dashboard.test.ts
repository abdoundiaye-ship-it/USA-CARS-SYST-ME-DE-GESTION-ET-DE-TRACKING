import { describe, expect, it } from "vitest";
import {
  buildIndicators,
  buildTodoList,
  calendarProgress,
  type DashboardContainer,
  type DashboardData,
  type DashboardDossier,
} from "./dashboard";

const now = new Date("2026-10-19T12:00:00Z");
const thresholds = { staleDossierDays: 7, recentEtaChangeDays: 3, maxDaysWithoutCheck: 3, unclaimedReminderDays: 30 };

const dossier = (over: Partial<DashboardDossier>): DashboardDossier => ({
  id: over.reference ?? "d",
  reference: "UC-2026-0001",
  stage: "opening",
  status: "new",
  updated_at: "2026-10-18T10:00:00Z",
  payment1_due_at: null,
  client_name: "Client",
  ...over,
});

const container = (over: Partial<DashboardContainer>): DashboardContainer => ({
  id: over.number ?? "c",
  number: "DEMU1234560",
  status: "booking_confirmed",
  etd: null,
  departed_on: null,
  eta: null,
  ata: null,
  last_checked_at: null,
  eta_changed_at: null,
  ...over,
});

const empty: DashboardData = {
  dossiers: [],
  confirmations: [],
  releasedDossierIds: new Set(),
  containers: [],
  assignments: [],
};

describe("liste « À traiter » (US-2.9)", () => {
  it("paiement 1 en retard, sauf s’il est confirmé reçu", () => {
    const late = dossier({ id: "a", reference: "A", stage: "purchase", payment1_due_at: "2026-10-18T10:00:00Z" });
    expect(buildTodoList({ ...empty, dossiers: [late] }, thresholds, now)[0]).toMatchObject({
      kind: "payment1_overdue",
      severity: "danger",
      label: "Paiement 1 en retard depuis le 18/10/2026",
      href: "/dossiers/a",
    });
    const paid = {
      ...empty,
      dossiers: [late],
      confirmations: [{ dossier_id: "a", code: "payment1_received" as const }],
    };
    expect(buildTodoList(paid, thresholds, now)).toEqual([]);
  });

  it("dossier sans mise à jour depuis plus de N jours (paramètre), jamais pour un dossier clôturé", () => {
    const stale = dossier({ id: "s", reference: "S", updated_at: "2026-10-10T10:00:00Z" });
    const closed = dossier({ id: "c", reference: "C", stage: "closing", updated_at: "2026-09-01T10:00:00Z" });
    const items = buildTodoList({ ...empty, dossiers: [stale, closed] }, thresholds, now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "stale", label: "Sans mise à jour depuis 9 jours" });
  });

  it("Dakar : véhicule non enlevé après le délai de relance, documents à remettre après le solde", () => {
    const d = dossier({ id: "k", reference: "K", stage: "dakar", status: "balance_pending" });
    const data: DashboardData = {
      ...empty,
      dossiers: [d],
      containers: [container({ id: "x", ata: "2026-09-10", status: "arrived" })],
      assignments: [{ dossier_id: "k", container_id: "x" }],
      confirmations: [{ dossier_id: "k", code: "balance_paid" }],
    };
    expect(buildTodoList(data, thresholds, now).map((i) => i.kind)).toEqual(["unclaimed", "documents_to_release"]);
    expect(buildTodoList({ ...data, releasedDossierIds: new Set(["k"]) }, thresholds, now).map((i) => i.kind)).toEqual([
      "unclaimed",
    ]);
  });

  it("conteneur en mer non vérifié et ETA modifiée récemment ; tri par gravité", () => {
    const data: DashboardData = {
      ...empty,
      dossiers: [dossier({ id: "s", reference: "S", updated_at: "2026-10-01T10:00:00Z" })],
      containers: [
        container({
          id: "m",
          status: "at_sea",
          departed_on: "2026-10-10",
          eta: "2026-11-02",
          eta_changed_at: "2026-10-18T09:00:00Z",
        }),
      ],
    };
    expect(buildTodoList(data, thresholds, now).map((i) => `${i.severity}:${i.kind}`)).toEqual([
      "warning:tracking_check",
      "info:eta_changed",
      "info:stale",
    ]);
  });
});

describe("indicateurs (sans montant)", () => {
  it("compte les dossiers actifs par étape, les conteneurs en mer et les arrivées prochaines", () => {
    const data: DashboardData = {
      ...empty,
      dossiers: [dossier({ id: "1" }), dossier({ id: "2", stage: "ocean" }), dossier({ id: "3", stage: "closing" })],
      containers: [
        container({ id: "a", status: "at_sea", eta: "2026-10-24" }),
        container({ id: "b", status: "arrived", ata: "2026-10-15", eta: "2026-10-14" }),
        container({ id: "c", eta: "2026-12-01" }),
      ],
    };
    const indicators = buildIndicators(data, 7, [], now);
    expect(indicators).toMatchObject({ activeDossiers: 2, containersAtSea: 1, arrivalsSoon: 1, payment1Overdue: 0 });
    expect(indicators.byStage.ocean).toBe(1);
  });
});

describe("progression calendaire (jamais une position)", () => {
  it("proportion de jours écoulés entre le départ et l’ETA", () => {
    expect(calendarProgress({ departed_on: "2026-10-09", eta: "2026-10-29", ata: null }, now)).toBeCloseTo(0.525, 2);
    expect(calendarProgress({ departed_on: null, eta: "2026-10-29", ata: null }, now)).toBeNull();
    expect(calendarProgress({ departed_on: "2026-10-09", eta: "2026-10-12", ata: null }, now)).toBe(1);
    expect(calendarProgress({ departed_on: "2026-10-09", eta: "2026-10-29", ata: "2026-10-18" }, now)).toBe(1);
  });
});
