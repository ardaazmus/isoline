import { sql } from "kysely";
import { appDb } from "@/server/db/client";

/** Liveness and database reachability (no tenant data). */
export async function GET() {
  let db: "up" | "down" | "not_configured" = "not_configured";
  if (process.env.DATABASE_URL) {
    db = await sql`select 1`
      .execute(appDb())
      .then(() => "up" as const)
      .catch(() => "down" as const);
  }
  return Response.json({ ok: db !== "down", service: "isoline-web", db, time: new Date().toISOString() }, { status: db === "down" ? 503 : 200, headers: { "cache-control": "no-store" } });
}
