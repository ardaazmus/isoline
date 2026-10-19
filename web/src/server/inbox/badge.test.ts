import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inboxCount = vi.fn<(actor: { userId: string; actingTenantId: string | null }) => Promise<number>>();
vi.mock("./service", () => ({ inboxCount: (a: { userId: string; actingTenantId: string | null }) => inboxCount(a) }));

const { inboxBadge } = await import("./badge");

describe("menu badge cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    inboxCount.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("serves the count for 30 seconds, then works it out again", async () => {
    const me = { userId: "u-ttl", actingTenantId: "t1" };
    inboxCount.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    expect(await inboxBadge(me)).toBe(3);
    vi.advanceTimersByTime(29_000);
    expect(await inboxBadge(me)).toBe(3);
    expect(inboxCount).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect(await inboxBadge(me)).toBe(5);
    expect(inboxCount).toHaveBeenCalledTimes(2);
  });

  it("keeps people and workspaces apart", async () => {
    inboxCount.mockImplementation(async (a) => (a.userId === "u-a" ? 1 : 2) * (a.actingTenantId === "t2" ? 10 : 1));
    expect(await inboxBadge({ userId: "u-a", actingTenantId: "t1" })).toBe(1);
    expect(await inboxBadge({ userId: "u-a", actingTenantId: "t2" })).toBe(10);
    expect(await inboxBadge({ userId: "u-b", actingTenantId: "t1" })).toBe(2);
    expect(await inboxBadge({ userId: "u-b", actingTenantId: null })).toBe(2);
    expect(inboxCount).toHaveBeenCalledTimes(4);
  });

  it("stays bounded: past 5 000 people it drops entries instead of growing", async () => {
    inboxCount.mockResolvedValue(0);
    for (let i = 0; i < 5_200; i++) await inboxBadge({ userId: `u-${i}`, actingTenantId: "t" });
    // the first person was dropped to make room, so their count is worked out again
    inboxCount.mockClear();
    await inboxBadge({ userId: "u-0", actingTenantId: "t" });
    expect(inboxCount).toHaveBeenCalledTimes(1);
  });
});
