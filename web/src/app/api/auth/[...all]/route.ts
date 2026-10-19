import { auth } from "@/server/auth/auth";

/** Better Auth endpoints (sign-in, sign-up, verification, reset, sessions, TOTP, OIDC callback). ADR-004. */
export async function GET(req: Request) {
  return auth().handler(req);
}

export async function POST(req: Request) {
  return auth().handler(req);
}
