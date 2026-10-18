import { NextResponse } from "next/server";

/** Liveness + DB yapılandırma bayrağı. Gerçek DB ping'i migrate sonrası eklenir. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "isoline-web",
    dbConfigured: Boolean(process.env.DATABASE_URL),
    time: new Date().toISOString(),
  });
}
