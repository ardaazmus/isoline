import { route } from "@/server/http/api";
import { approveBoundary } from "@/server/projects/service";

export const POST = route({ status: 200 }, async ({ actor, params }) => {
  await approveBoundary(actor, params.boundaryId);
  return { ok: true };
});
