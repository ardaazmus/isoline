// Runs the validation package and writes validation/RESULTS.md (cross-platform: sets the env var itself).
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "src/validation"], { stdio: "inherit", shell: true, env: { ...process.env, VALIDATION_REPORT: "1" } });
process.exit(r.status ?? 1);
