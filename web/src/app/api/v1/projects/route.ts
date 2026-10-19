import { route } from "@/server/http/api";
import { CreateProject } from "@/server/http/schemas";
import { createProject, listProjects } from "@/server/tenancy/service";

export const GET = route({}, async ({ actor }) => ({ projects: await listProjects(actor) }));
export const POST = route({ body: CreateProject }, async ({ actor, input }) => ({ projectId: await createProject(actor, input) }));
