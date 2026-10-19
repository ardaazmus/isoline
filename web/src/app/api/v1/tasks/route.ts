import { route } from "@/server/http/api";
import { myTasks } from "@/server/data/service";

/** DATA-04: tasks waiting for me as assignee or reviewer. */
export const GET = route({}, async ({ actor }) => ({ tasks: await myTasks(actor) }));
