# ADR-009 — Hesap çalıştırma, metrik defteri ve soy ağacı

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 09; 06 §3, §6; G4

## Karar

**`CalculationContext`** mevcut saf hesap motorlarını değiştirmeden sarar:
- girdiler: onaylı gözlem sürümleri;
- faktör seti sürümü;
- sınır (boundary) sürümü;
- dönem.

**`calculation_runs`** her çalışmayı kaydeder:
- `input_digest`: girdilerin kanonik JSON'unun SHA-256'sı, anahtarları sıralanmış;
- `engine_version`: `package.json` sürümü + derleme commit'i (`GIT_SHA`);
- `factor_set_version`, `boundary_version_id`;
- `output_digest` ve `result_json`.

Aynı `input_digest` + motor + faktör + sınır kombinasyonu **tekrar çalıştırılmaz**, var olan çalışma döner (idempotent).

**`metric_fact_versions`** değeri `numeric(38,12)` olarak tutar; birimi, dönemi, tesisi ve çalışma kimliğini taşır.
- Durum akışı: `draft` → `validating` → `ready_for_review` → `approved` → `locked`.
- Kilitli bir olgu düzeltilmez. Yeni bir sürüm açılır ve eskisinin yerine geçtiği `supersedes_id` ile kaydedilir.

**Soy ağacı:** kanıt → gözlem sürümü → çalışma → olgu sürümü → rapor bölümü sürümü. Ara tablolar `run_inputs`, `evidence_links` ve `metric_references`'tır.

## Gerekçe

- **Plan 09:** "Kaynak → hesap → metrik soy ağacı ve eşdeğerlik".
- **Sektör:** Karbon defteri ürünleri (Persefoni, Watershed) ve güvence beklentisi, her rakamın yeniden üretilebilir olmasını ister (KPMG, Deloitte notları; [DENETIM_RAPORLAMA_2026-10.md](../../DENETIM_RAPORLAMA_2026-10.md) §6).
- **Motorların korunması:** v1 testleri ve doğrulama paketi (16 vaka) eşdeğerlik referansı olarak kalır.
