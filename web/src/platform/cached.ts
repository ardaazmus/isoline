/**
 * Request-scoped memo of lookups several parts of one project page need (the step bar in the header, the page
 * itself): React's cache() keys on the arguments, and requireWorkspace hands every part the same actor object, so
 * a page render asks the database once (G8-07 load test).
 */
import { cache } from "react";
import type { Actor } from "@/server/db/client";
import { listCycles } from "@/server/projects/service";
import { cycleProgress } from "@/server/cycle/progress";

export const projectCycles = cache((actor: Actor, projectId: string) => listCycles(actor, projectId));
export const cycleSteps = cache((actor: Actor, cycleId: string) => cycleProgress(actor, cycleId));
