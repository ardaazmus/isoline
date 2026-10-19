/**
 * Shared Intl formatters (server and browser). Building an Intl.NumberFormat or DateTimeFormat costs far more than
 * formatting with one — in the load test's CPU profile, constructing one per value took 6 % of the calculations
 * page's server time — so each locale and option set is built once and reused. Formatters are stateless. The keys
 * come from the code's own option sets and the supported locales; a cap keeps an unexpected locale from growing the
 * map without bound.
 */
const LIMIT = 256;
const numbers = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();

function cached<F, O>(store: Map<string, F>, locale: string, opts: O, make: () => F): F {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = store.get(key);
  if (!f) {
    f = make();
    if (store.size < LIMIT) store.set(key, f);
  }
  return f;
}

export const numberFormat = (locale: string, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat => cached(numbers, locale, opts, () => new Intl.NumberFormat(locale, opts));

export const dateTimeFormat = (locale: string, opts: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat => cached(dates, locale, opts, () => new Intl.DateTimeFormat(locale, opts));
