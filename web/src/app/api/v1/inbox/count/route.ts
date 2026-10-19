import { route } from "@/server/http/api";
import { inboxBadge } from "@/server/inbox/badge";

/** How many things wait for this person (the menu badge; up to 30 seconds old). */
export const GET = route({}, async ({ actor }) => ({ count: await inboxBadge(actor) }));
