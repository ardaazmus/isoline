import { describe, expect, it } from "vitest";
import { addEvidenceRequest, addNote, answerNote, asAudit, emptyAudit, notesFor, openAuditCounts, setEvidenceRequestStatus, setNoteStatus } from "./auditor";

const AT = "2026-10-18T10:00:00.000Z";

describe("auditor notes", () => {
  it("adds, answers and closes a section note", () => {
    let s = emptyAudit();
    const added = addNote(s, { targetType: "section", targetId: "ghg", author: "Denetçi", body: "Fatura eksik", at: AT });
    expect("next" in added && added.next.notes).toHaveLength(1);
    if (!("next" in added)) return;
    s = added.next;
    const id = s.notes[0].id;
    const answered = answerNote(s, id, { by: "Hazırlayan", body: "Eklendi", at: AT });
    expect("next" in answered && answered.next.notes[0].status).toBe("answered");
    if (!("next" in answered)) return;
    const closed = setNoteStatus(answered.next, id, "closed");
    expect("next" in closed && closed.next.notes[0].status).toBe("closed");
    expect(notesFor(s, "ghg")).toHaveLength(1);
    expect(notesFor(s, "cbam")).toHaveLength(0);
  });

  it("refuses empty author and body", () => {
    expect(addNote(emptyAudit(), { targetType: "section", targetId: "ghg", author: " ", body: "x", at: AT })).toEqual({ error: "needName" });
    expect(addNote(emptyAudit(), { targetType: "section", targetId: "ghg", author: "A", body: "  ", at: AT })).toEqual({ error: "needBody" });
  });

  it("repairs hand-edited state instead of crashing", () => {
    expect(asAudit(null)).toEqual(emptyAudit());
    expect(asAudit({ notes: [{ id: "1", body: "x" }], requests: "nope" }).notes).toHaveLength(1);
  });
});

describe("evidence requests", () => {
  it("tracks open counts and fulfilment", () => {
    let s = emptyAudit();
    const added = addEvidenceRequest(s, { targetId: "ghg_electricity", requestedBy: "Denetçi", note: "Q3 faturası", at: AT });
    if (!("next" in added)) throw new Error("should add");
    s = added.next;
    expect(openAuditCounts(s)).toEqual({ notes: 0, requests: 1 });
    const done = setEvidenceRequestStatus(s, s.requests[0].id, "fulfilled");
    if (!("next" in done)) throw new Error("should update");
    expect(openAuditCounts(done.next).requests).toBe(0);
  });
});
