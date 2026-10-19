/**
 * What every platform page needs about the signed-in person, in one statement (G8-07 load test: under load each round
 * trip waits its turn): the live memberships, as myMemberships, and the unread notification count (unreadQuery).
 * The layout and requireWorkspace share it once per request (http/dal.ts).
 */
import { sql } from "kysely";
import { withActor } from "../db/client";
import { unreadQuery } from "../data/service";
import { membershipsQuery, toMembership, type Membership } from "./service";

type MembershipRow = Parameters<typeof toMembership>[0];

export async function personContext(userId: string): Promise<{ memberships: Membership[]; unread: number }> {
  return withActor({ userId, actingTenantId: null }, async (tx) => {
    const r = await tx
      .selectNoFrom([
        // the order is given to json_agg as well: an aggregate keeps a sorted subquery's order only "usually"
        sql<MembershipRow[]>`(select coalesce(json_agg(x order by x.name), '[]'::json) from (${membershipsQuery(tx, userId)}) as x)`.as("memberships"),
        unreadQuery(tx, userId).$asScalar().as("unread"),
      ])
      .executeTakeFirstOrThrow();
    return { memberships: r.memberships.map(toMembership), unread: Number(r.unread ?? 0) };
  });
}
