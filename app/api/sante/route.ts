import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/server/health";

export const dynamic = "force-dynamic";

/** État de l’application (sans donnée) : utilisé pour la surveillance et les tests. */
export async function GET() {
  const base = await checkDatabaseHealth();
  return NextResponse.json({ application: "ok", base }, { status: base === "ok" ? 200 : 503 });
}
