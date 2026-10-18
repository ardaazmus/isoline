// Deterministic synthetic trial balance for stress tests. Every amount is an integer number of kuruş, so the
// expected totals are exact; the CSV writes them in Turkish format ("1.234.567,89") to exercise the parser.
import { R, sum } from "./rat.mjs";

/** Mulberry32: small, seedable, reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tl = (kurus) => {
  const neg = kurus < 0n;
  const v = neg ? -kurus : kurus;
  const lira = (v / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${lira},${(v % 100n).toString().padStart(2, "0")}`;
};

const MAINS = ["100", "102", "120", "150", "153", "253", "254", "255", "320", "335", "360", "391", "500", "570", "600", "601", "602", "610", "611", "620", "631", "632", "656", "660", "770"];

/**
 * Builds `rows` detail rows: each main account gets sub-accounts (600.01, 600.01.001 …), and every amount is
 * mirrored by a balancing posting so total debits equal total credits. Main rows are omitted half the time,
 * so the parser must both use main rows and sum sub-accounts.
 */
export function generateMizan(seed, rows) {
  const next = rng(seed);
  const lines = [];
  const debit = new Map();
  const credit = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) ?? 0n) + v);
  let n = 0;
  while (n < rows) {
    const main = MAINS[Math.floor(next() * MAINS.length)];
    const sub = `${main}.${String(1 + Math.floor(next() * 40)).padStart(2, "0")}.${String(1 + Math.floor(next() * 900)).padStart(3, "0")}`;
    const amount = BigInt(1 + Math.floor(next() * 5_000_000_00)); // up to 5 m TRY, in kuruş
    const isCredit = /^(3|5|60)/.test(main) || main === "391";
    // balancing posting on a bank/receivable sub-account
    const contra = `${isCredit ? "102" : "320"}.99.${String(1 + Math.floor(next() * 900)).padStart(3, "0")}`;
    lines.push([sub, isCredit ? 0n : amount, isCredit ? amount : 0n]);
    lines.push([contra, isCredit ? amount : 0n, isCredit ? 0n : amount]);
    add(isCredit ? credit : debit, main, amount);
    add(isCredit ? debit : credit, contra.slice(0, 3), amount);
    n += 2;
  }
  // Merge duplicate sub-accounts (a real export lists each once).
  const merged = new Map();
  for (const [code, d, c] of lines) {
    const cur = merged.get(code) ?? [0n, 0n];
    merged.set(code, [cur[0] + d, cur[1] + c]);
  }
  const codes = [...merged.keys()].sort();
  const mains = [...new Set(codes.map((c) => c.slice(0, 3)))];
  const showMain = new Set(mains.filter(() => next() < 0.5));
  const out = ["Sentetik Mizan 01.01.2026 - 31.12.2026", "", "Hesap Kodu;Hesap Adı;Borç;Alacak;Borç Bakiye;Alacak Bakiye"];
  for (const m of mains) {
    if (showMain.has(m)) {
      const d = debit.get(m) ?? 0n;
      const c = credit.get(m) ?? 0n;
      out.push([m, `Ana hesap ${m}`, tl(d), tl(c), tl(d > c ? d - c : 0n), tl(c > d ? c - d : 0n)].join(";"));
    }
    for (const code of codes.filter((c) => c.startsWith(m + "."))) {
      const [d, c] = merged.get(code);
      out.push([code, `Alt hesap ${code}`, tl(d), tl(c), tl(d > c ? d - c : 0n), tl(c > d ? c - d : 0n)].join(";"));
    }
  }
  const k = (m, map) => map.get(m) ?? 0n;
  const bal = (m) => k(m, credit) - k(m, debit); // credit-positive for sales
  const gross = ["600", "601", "602"].reduce((s, m) => s + bal(m), 0n);
  const deductions = ["610", "611", "612"].reduce((s, m) => s - bal(m), 0n);
  const totalDebit = [...debit.values()].reduce((s, v) => s + v, 0n);
  const totalCredit = [...credit.values()].reduce((s, v) => s + v, 0n);
  return {
    csv: "﻿" + out.join("\r\n") + "\r\n",
    detailRows: codes.length + mains.filter((m) => showMain.has(m)).length,
    expected: {
      grossSales: R(gross).div(100).toFixed(2),
      deductions: R(deductions).div(100).toFixed(2),
      netSales: R(gross - deductions).div(100).toFixed(2),
      totalDebit: R(totalDebit).div(100).toFixed(2),
      totalCredit: R(totalCredit).div(100).toFixed(2),
      mainAccounts: mains.length,
    },
  };
}

export { sum };
