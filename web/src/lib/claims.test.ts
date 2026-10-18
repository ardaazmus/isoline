import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { countByRule, screenClaims } from "./claims";

describe("green-claim screen (Directive 2024/825)", () => {
  it("flags generic Turkish claims, including capitalised İ/I forms", () => {
    const hits = screenClaims("ÇEVRE DOSTU ambalaj ve İklim Dostu üretim.", "tr");
    expect(hits.map((h) => h.rule)).toEqual(["generic", "generic"]);
    expect(hits[0].text).toBe("ÇEVRE DOSTU");
    expect(hits[1].text).toBe("İklim Dostu");
  });
  it("flags offset-based neutrality claims", () => {
    expect(screenClaims("Ürünümüz karbon nötr.", "tr")[0].rule).toBe("offset");
    expect(screenClaims("This product is carbon-neutral.", "en")[0].rule).toBe("offset");
  });
  it("flags future performance claims in either order", () => {
    expect(screenClaims("2030 yılına kadar net sıfır olacağız.", "tr")[0].rule).toBe("future");
    expect(screenClaims("Net sıfır hedefimiz 2040.", "tr")[0].rule).toBe("future");
    expect(screenClaims("We will reach net zero by 2040.", "en")[0].rule).toBe("future");
  });
  it("does not match inside longer words or plain numbers", () => {
    expect(screenClaims("Ekolojikleştirme 2030 bütçesi", "tr")).toEqual([]);
    expect(screenClaims("geography and ecosystems", "en")).toEqual([]);
  });
  it("flags Turkish claims with case and copula suffixes", () => {
    const rule = (s: string) => screenClaims(s, "tr").map((h) => [h.rule, h.text]);
    expect(rule("Ürünümüz çevre dostudur.")).toEqual([["generic", "çevre dostudur"]]);
    expect(rule("Fabrikamız karbon nötrdür.")).toEqual([["offset", "karbon nötrdür"]]);
    expect(rule("Ambalajımız çevreye zararsızdır.")).toEqual([["absolute", "zararsızdır"]]);
    expect(rule("Yeşil ürünlerimiz")).toEqual([["generic", "Yeşil ürünlerimiz"]]);
  });
  it("flags positive-impact, offsetting and 'fully sustainable' claims in both languages", () => {
    const rules = (s: string, lang: string) => screenClaims(s, lang).map((h) => h.rule);
    expect(rules("Ürünümüz iklim pozitiftir.", "tr")).toEqual(["offset"]);
    expect(rules("Karbon negatif çelik üretiyoruz.", "tr")).toEqual(["offset"]);
    expect(rules("Emisyonlarımızı karbon kredileriyle telafi ediyoruz.", "tr")).toEqual(["offset"]);
    expect(rules("Tamamen sürdürülebilir bir tedarik zincirimiz var.", "tr")).toEqual(["absolute"]);
    expect(rules("Our steel is carbon negative.", "en")).toEqual(["offset"]);
    expect(rules("We compensate our emissions.", "en")).toEqual(["offset"]);
    expect(rules("Our emissions are covered with carbon credits.", "en")).toEqual(["offset"]);
    expect(rules("A fully sustainable supply chain.", "en")).toEqual(["absolute"]);
  });
  it("does not flag verbs formed with -laş/-leş (decarbonisation, waste neutralisation)", () => {
    expect(screenClaims("Karbonsuzlaştırma yol haritamız hazır.", "tr")).toEqual([]);
    expect(screenClaims("Tehlikeli atıkların zararsızlaştırılması lisanslı tesiste yapılır.", "tr")).toEqual([]);
  });
  it("counts hits per rule", () => {
    const c = countByRule(screenClaims("Çevre dostu, karbon nötr ve %100 yeşil.", "tr"));
    expect(c).toEqual({ offset: 1, future: 0, absolute: 1, generic: 1 });
  });
  it("property: hits are ordered, non-overlapping and point at the original text", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("çevre dostu", "karbon nötr", "2030'a kadar net sıfır", "rapor", "yeşil ürün", "%100 temiz", "İKLİM DOSTU", ".", " ", "\n"), { maxLength: 30 }),
        (parts) => {
          const text = parts.join(" ");
          const hits = screenClaims(text, "tr");
          for (let i = 0; i < hits.length; i++) {
            expect(text.slice(hits[i].start, hits[i].end)).toBe(hits[i].text);
            if (i > 0) expect(hits[i].start).toBeGreaterThanOrEqual(hits[i - 1].end);
          }
        },
      ),
    );
  });
});
