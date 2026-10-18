// Exact rational arithmetic on BigInt numerators and denominators. The validation cases compute their expected
// results with this module, along a code path that shares nothing with the app's calculation engines, so a
// floating-point or formula error in the app cannot reproduce itself in the expected value.

const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

export class Rat {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error("division by zero");
    if (d < 0n) [n, d] = [-n, -d];
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }

  /** From a decimal string ("1,234.5" not accepted; use "1234.5" or "1234,5"), a safe integer or a Rat. */
  static of(v) {
    if (v instanceof Rat) return v;
    if (typeof v === "bigint") return new Rat(v);
    if (typeof v === "number") {
      if (!Number.isInteger(v)) throw new Error(`pass decimals as strings for exactness: ${v}`);
      return new Rat(BigInt(v));
    }
    const s = String(v).trim().replace(",", ".");
    const m = s.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!m) throw new Error(`not a decimal: ${v}`);
    const frac = m[3] ?? "";
    const n = BigInt(m[2] + frac) * (m[1] ? -1n : 1n);
    return new Rat(n, 10n ** BigInt(frac.length));
  }

  add(o) { o = Rat.of(o); return new Rat(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Rat.of(o); return new Rat(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Rat.of(o); return new Rat(this.n * o.n, this.d * o.d); }
  div(o) { o = Rat.of(o); return new Rat(this.n * o.d, this.d * o.n); }
  min(o) { o = Rat.of(o); return this.cmp(o) <= 0 ? this : o; }
  max(o) { o = Rat.of(o); return this.cmp(o) >= 0 ? this : o; }
  abs() { return this.n < 0n ? new Rat(-this.n, this.d) : this; }
  cmp(o) { o = Rat.of(o); const x = this.n * o.d - o.n * this.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }

  /** Decimal string with `digits` fraction digits, rounded half away from zero. */
  toFixed(digits = 12) {
    const scale = 10n ** BigInt(digits);
    const neg = this.n < 0n;
    const n = neg ? -this.n : this.n;
    let q = (n * scale) / this.d;
    const r = (n * scale) % this.d;
    if (r * 2n >= this.d) q += 1n;
    const s = q.toString().padStart(digits + 1, "0");
    const out = digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s;
    return (neg && q !== 0n ? "-" : "") + out;
  }

  /** Nearest double, via a 20-digit decimal string. */
  toNumber() { return Number(this.toFixed(20)); }
}

export const R = (v) => Rat.of(v);
export const sum = (xs) => xs.reduce((a, x) => a.add(x), R(0));
