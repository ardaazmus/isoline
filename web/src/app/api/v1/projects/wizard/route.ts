import { route } from "@/server/http/api";
import { ProjectWizard } from "@/server/http/schemas";
import { createProjectWizard } from "@/server/projects/service";

/** PORT-07: project, first reporting cycle, 13-gate plan and the creator as lead in one step. */
export const POST = route({ body: ProjectWizard }, async ({ actor, input }) => createProjectWizard(actor, input));
