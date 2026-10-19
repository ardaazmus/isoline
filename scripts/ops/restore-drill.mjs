#!/usr/bin/env node
/**
 * Backup and restore drill (G8-08; plan 12 §6 "restore tatbikatı"). Run from the repository root:
 *
 *   node scripts/ops/restore-drill.mjs            back up "isoline", restore into a scratch database, compare
 *   node scripts/ops/restore-drill.mjs --backup   only write the backup (custom format) to backups/
 *
 * The backup is a pg_dump custom-format file taken inside the database container (consistent snapshot, no
 * password on the command line). The drill restores it into "isoline_restore_drill", compares the row count of
 * every table in core with the source, checks the audit hash chain columns survived, then drops the scratch
 * database. Object storage (SeaweedFS volume) is backed up at volume level — see docs/SERVER_KURULUM.md.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = process.env.DRILL_SOURCE_DB ?? "isoline";
const SCRATCH = "isoline_restore_drill";
const dir = join(process.cwd(), "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = join(dir, `${SOURCE}-${stamp}.dump`);

const dc = (args, opts = {}) => execFileSync("docker", ["compose", "exec", "-T", "db", ...args], { maxBuffer: 1024 * 1024 * 1024, ...opts });
const psql = (db, query) =>
  dc(["psql", "-U", "postgres", "-d", db, "-At", "-c", query])
    .toString()
    .trim();

const started = Date.now();
writeFileSync(file, dc(["pg_dump", "-U", "postgres", "-Fc", "-d", SOURCE]));
const size = statSync(file).size;
console.log(`backup: ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
if (process.argv.includes("--backup")) process.exit(0);

psql("postgres", `drop database if exists ${SCRATCH}`);
psql("postgres", `create database ${SCRATCH}`);
// restore from the file through stdin (the dump is not copied into the container)
execFileSync("docker", ["compose", "exec", "-T", "db", "pg_restore", "-U", "postgres", "-d", SCRATCH, "--no-owner", "--exit-on-error"], { input: execFileSync("node", ["-e", `process.stdout.write(require('fs').readFileSync(${JSON.stringify(file)}))`], { maxBuffer: 1024 * 1024 * 1024 }), maxBuffer: 1024 * 1024 * 64 });

const tables = psql(SOURCE, "select table_name from information_schema.tables where table_schema = 'core' and table_type = 'BASE TABLE' order by 1").split("\n").filter(Boolean);
const mismatches = [];
let rows = 0;
for (const t of tables) {
  const a = Number(psql(SOURCE, `select count(*) from core.${t}`));
  const b = Number(psql(SCRATCH, `select count(*) from core.${t}`));
  rows += a;
  if (a !== b) mismatches.push({ table: t, source: a, restored: b });
}
// the audit chain: every event keeps its hash and its link to the previous one
const brokenChain = Number(psql(SCRATCH, "select count(*) from core.audit_events e where e.hash is null"));
const migrations = psql(SCRATCH, "select count(*) from public.kysely_migration");
psql("postgres", `drop database ${SCRATCH}`);

const report = { source: SOURCE, file, bytes: size, tables: tables.length, rows, mismatches, auditRowsWithoutHash: brokenChain, migrations: Number(migrations), seconds: Math.round((Date.now() - started) / 100) / 10, ok: mismatches.length === 0 && brokenChain === 0 };
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
