# ADR-010 — Standart ve kural sicili (FrameworkPackVersion)

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 07; G0-03, G2-06, G6-03, G8-03

## Karar

**Tablolar:**
- `framework_packs`: TSRS, GRI, ESRS, faaliyet raporu (TTK / SPK / BDDK), SKDM, TR ETS, VSME, CDP.
- `framework_versions`: sürüm kodu, geçerlilik başlangıcı ve bitişi, kaynak referansı ve kaynağın kontrol tarihi.
- `disclosure_requirements`: her gereklilik ve onun
  - kodu (ör. `TSRS2.29a`, `GRI305-1`, `Yön28395.md12`);
  - yükümlülük sınıfı: `mandatory`, `conditional`, `voluntary`, `recommended`;
  - koşul ifadesi, kaynak sayfası ve doğrulama durumu: `official`, `secondary`, `unverified`.
- `requirement_metric_links`: gereklilik → metrik tanımı.
- `applicability_assessments`: proje + dönem + paket sürümü için öneri ve **uzman kararı**. Karar; kararı veren, gerekçe ve kaynakla tutulur.

**Doğrulanmamış gereklilikler:** `unverified` durumundaki bir gereklilik rapora otomatik "zorunlu" ifadesi eklemez (plan 14 §4).

**İlk dolum:** Mevcut doğrulanmış verilerden yapılır:
- `templates.ts`, `crosswalk.ts`, `annual-report.ts`, `sources.ts`;
- `docs/DOGRULAMA_2026-10.md` ve `docs/DENETIM_RAPORLAMA_2026-10.md` kaynakları.

Her kayıt kendi kaynağını ve kontrol tarihini taşır.

## Gerekçe

- **Plan 07:** "TSRS, GRI, ESRS, faaliyet, CBAM aynı metodoloji değildir"; "güncel kaynak/sürüm olmadan yasal zorunluluk iddiası yok".
- **Kapsam testi:** Bugünkü kapsam testi kesin hüküm veriyor. Bu yapıda yalnız öneri üretir; kararı uzman verir.
