# ISOLINE ERP — Uygulama durumu (G0–G8)

**Kaynak plan:** [plan/](plan/README.md) (ISOLINE_ERP_2026_Master_Plan v1.0, MANIFEST özetleri doğrulandı) · **Karar kayıtları:** [adr/](adr/) · **G0 çıktıları:** [G0/](G0/)

**Durum değerleri:** `bitti` · `kısmi` · `engelli` · `başlamadı`. Plan kuralı gereği "bitti" demek için çalışan akış, kullanıcı yetkisi, kaynak kanıtı ve otomatik test birlikte gösterilmeli; karşılanmayan kısım `kısmi` olarak kalır.

**Ürün sahibi talimatı (19.10.2026):** Soru sormadan, sektördeki yerleşik çözümlerle bütün yol haritasını uygula; burada commit'le; GitHub'a gönderim en sona kalsın. Bu talimat G0 onayı olarak kayıtlıdır.

## Özet

| Kapı | Durum | Not |
|---|---|---|
| G0 | bitti | Envanter, 11 ADR, ekran haritası, göç riski, iki yolculuk, tehdit modeli |
| G1 | başlamadı | |
| G2 | başlamadı | |
| G3 | başlamadı | |
| G4 | başlamadı | |
| G5 | başlamadı | |
| G6 | başlamadı | |
| G7 | başlamadı | |
| G8 | başlamadı | |

## G0 — Analiz, karar, envanter

| ID | Durum | Kanıt |
|---|---|---|
| G0-01 | bitti | [01_KOD_ENVANTERI.md](G0/01_KOD_ENVANTERI.md): 348 test, typecheck, lint, validate ve build baz çizgisi |
| G0-02 | bitti | [ADR-002](adr/ADR-002-kiraci-ve-dis-erisim.md), [04_UAT_SENARYOLARI.md](G0/04_UAT_SENARYOLARI.md) |
| G0-03 | bitti | [ADR-010](adr/ADR-010-standart-ve-kural-sicili.md) |
| G0-04 | bitti | [02_EKRAN_HARITASI.md](G0/02_EKRAN_HARITASI.md), [ADR-011](adr/ADR-011-arayuz-kabugu.md) |
| G0-05 | bitti | [03_GOC_RISK_KAYDI.md](G0/03_GOC_RISK_KAYDI.md) |
| G0-06 | bitti | [04_UAT_SENARYOLARI.md](G0/04_UAT_SENARYOLARI.md) |
| G0-07 | bitti | [05_TEHDIT_MODELI.md](G0/05_TEHDIT_MODELI.md) |

## G1 — Kimlik, kiracı, PostgreSQL

| ID | Durum | Kanıt |
|---|---|---|
| G1-01 | başlamadı | |
| G1-02 | başlamadı | |
| G1-03 | başlamadı | |
| G1-04 | başlamadı | |
| G1-05 | başlamadı | |
| G1-06 | başlamadı | |
| G1-07 | başlamadı | |
| G1-08 | başlamadı | |
| G1-09 | başlamadı | |
| G1-10 | başlamadı | |
| G1-11 | başlamadı | |
| G1-12 | başlamadı | |

## G2–G8

Kapı başladıkça buraya ayrıntılı tablo eklenir. Görev listeleri plan 13'te.

## Oturum kontrol noktası (bağlam sıkıştırmasına karşı)

- **Oturum amacı:** ERP yol haritasını G0'dan G8'e uygulamak, burada commit'lemek, GitHub'a en sonda göndermek.
- **Dokunulan dosyalar:** `docs/erp/**`.
- **Kararlar:**
  - barındırma kendi sunucumuz (ADR-001);
  - veri katmanı Kysely + SQL migration (ADR-003);
  - kimlik Better Auth (ADR-004);
  - depo MinIO (ADR-005);
  - modüler monolit (ADR-007);
  - v1 araç seti korunuyor (ADR-008).
- **Açık / sıradaki:** G1-01 (Compose: `isoline-main` projesi, 5545 portu; şema; roller; migration).
