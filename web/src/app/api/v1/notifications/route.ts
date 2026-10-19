import { route } from "@/server/http/api";
import { myNotifications } from "@/server/data/service";

export const GET = route({ tenant: "optional" }, async ({ actor }) => ({ notifications: await myNotifications(actor) }));
