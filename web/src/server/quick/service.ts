/**
 * "Döngüye kaydet" (UX Faz 3): a quick calculation's inputs become drafts of the person's own open data requests.
 * Nothing skips the flow — the draft is saved through saveDraft (assignee only, the request's unit and line rules),
 * and the person still links evidence and submits it for a second person's review.
 */
import { withActor, type Actor } from "../db/client";
import { HttpError } from "../policy/policy";
import { saveDraft, type DraftInput } from "../data/service";
import type { QuickDraft } from "@/lib/quick-drafts";

/** The person's open requests (assigned to them, still editable) for these data points, newest cycle first. */
export async function quickTargets(actor: Actor, metrics: string[]) {
  if (!metrics.length) return [];
  return withActor(actor, (tx) =>
    tx
      .selectFrom("core.data_requests as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .innerJoin("core.reporting_cycles as c", "c.id", "r.cycle_id")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .select(["r.id", "r.metric_code", "r.status", "r.due_on", "r.period_label", "p.id as project_id", "p.name as project_name", "c.label as cycle_label", "f.name as facility_name"])
      .where("r.assignee_user_id", "=", actor.userId)
      .where("r.status", "in", ["assigned", "sent", "revision_required"])
      .where("r.metric_code", "in", metrics)
      .where("c.status", "not in", ["frozen", "released"])
      .orderBy("c.period_end", "desc")
      .orderBy("p.name")
      .limit(200)
      .execute(),
  );
}

export type QuickSave = { requestId: string; draft: QuickDraft };

/** Saves each pairing as a draft; one failure does not stop the others, and every outcome is reported. */
export async function saveQuickDrafts(actor: Actor, items: QuickSave[]): Promise<{ requestId: string; ok: boolean; code?: string }[]> {
  if (!items.length || items.length > 50) throw new HttpError(422, "invalid_items");
  const out: { requestId: string; ok: boolean; code?: string }[] = [];
  for (const { requestId, draft } of items) {
    const d: DraftInput = {
      value: draft.value ?? null,
      unit: draft.unit ?? null,
      lines: draft.lines ?? null,
      quality: "calculated",
      methodNote: "Hızlı hesaptan aktarıldı (girdiler); kanıt eklenip gönderilmeli.",
    };
    try {
      await saveDraft(actor, requestId, d);
      out.push({ requestId, ok: true });
    } catch (e) {
      out.push({ requestId, ok: false, code: e instanceof HttpError ? e.code : "error" });
    }
  }
  return out;
}
