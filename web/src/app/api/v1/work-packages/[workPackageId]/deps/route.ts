import { route } from "@/server/http/api";
import { AddDependency } from "@/server/http/schemas";
import { addDependency } from "@/server/projects/service";

export const POST = route({ body: AddDependency }, async ({ actor, input, params }) => {
  await addDependency(actor, params.workPackageId, input.dependsOnId);
  return { ok: true };
});
