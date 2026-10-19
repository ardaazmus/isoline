import { route } from "@/server/http/api";
import { reviewQueue } from "@/server/close/service";

/** CTRL-06: what waits for this person's decision — never their own work. */
export const GET = route({}, async ({ actor }) => reviewQueue(actor));
