/** Demo roles the journeys sign in as, and where the setup step keeps each session. */
export const ROLES = ["ayse", "zeynep", "can", "selin", "elif"] as const;
export type Role = (typeof ROLES)[number];
export const stateOf = (who: Role) => `e2e/.auth/${who}.json`;
