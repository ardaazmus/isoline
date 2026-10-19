import { route } from "@/server/http/api";
import { EnablePack } from "@/server/http/schemas";
import { enablePack, projectPacks } from "@/server/industry/service";

/** G7-04: industry packs of the project (suggested from facility NACE codes); POST switches one on for facilities. */
export const GET = route({}, async ({ actor, params }) => projectPacks(actor, params.projectId));
export const POST = route({ body: EnablePack, status: 200 }, async ({ actor, input, params }) => {
  await enablePack(actor, params.projectId, input.packId, input.facilityIds);
  return { ok: true };
});
