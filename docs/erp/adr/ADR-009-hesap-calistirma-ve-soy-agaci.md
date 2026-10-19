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

## G4 uygulama notu (19.10.2026)

- **Motor sürümü:** `isoline-calc <tarih>` + derlemede `ISOLINE_BUILD_SHA` verilirse commit'in ilk 12 hanesi. Kural seti ayrıca `rule_version` olarak saklanır.
- **Girdi özeti:** kabul edilmiş gözlem sürümleri (kanonik değer, satırlar, kalite), sınır revizyonu ve tesis payları, mizan dosyasının SHA-256'sı, açık talepler ve mükerrer kalemler. Açık bir talebin kapanması, değerler aynı kalsa da yeni bir girdi durumudur.
- **Faktör özeti:** hedef adına göre sıralanır (jsonb anahtar sırasını değiştirdiği için); değer kimliği, değer, NCV, CH₄, N₂O.
- **Kanıt:** karantinaya alınmamış ve reddedilmemiş bütün bağlı dosyalar `run_inputs`'a girer; mizan dosyası yeniden üretimde tekrar okunur ve SHA-256'sı doğrulanır.
- **Durumlar:** plandaki `draft` ayrı tutulmadı: sonuç engel varken `validating`, yoksa `ready_for_review` doğar. Onaylı revizyon, yenisi onaylanana dek geçerli kalır; yeni çalışma yalnız onaylanmamış revizyonları `superseded` yapar.
- **Engelleyici / uyarı:** engelleyici yalnız girdi düzeltilip yeniden hesaplanarak kalkar; uyarı, hesabı çalıştırandan başka biri tarafından gerekçeyle açıklanır ya da istisna olarak kabul edilir. Onay, açık bulgu varken yapılamaz.
- **Rapor bölümü bağlantısı** (`metric_references`) G6'da rapor stüdyosuyla gelir.
