# G0-05 — Veri göçü risk kaydı (tarayıcı çalışma alanı v2–v11 → PostgreSQL)

| # | Risk | Olasılık / Etki | Önlem | Kabul testi |
|---|---|---|---|---|
| R1 | `ClientData` tüzel kişi bilgisi taşımıyor; yalnız `name` ve `sector` var | Yüksek / Orta | Organizasyon `UNMAPPED` etiketiyle oluşur; tüzel kişi ve tesis kullanıcı onayıyla eşlenir | İçe aktarma önizlemesi eşlenmemiş alanları listeler |
| R2 | Raporlama yılı birden fazla yerde (`profile.reportingYear`, `ghg.year`) | Orta / Orta | Dönem olarak `profile.reportingYear` önerilir; `ghg.year` farklıysa uyarı verilir | İki yıl farklı olan örnekte uyarı çıkar |
| R3 | Onaylar yazılı isimle verilmiş (v8 ve sonrası) | Kesin / Yüksek | `legacy_unverified_approval` denetim olayı olur; onay ve kilit yetkisi doğurmaz | Göçten sonra bütün bölümler `draft` görünür |
| R4 | Veri talep sahipleri metin (v9) | Kesin / Orta | `legacy-owner-label`; atama ancak gerçek kullanıcıya yeniden yapılınca geçerli | Talep listesi sahipsiz görünür |
| R5 | Kanıt dosyalarının kendisi yok, yalnız SHA-256 özeti var | Kesin / Orta | `awaiting_file` durumu; dosya yüklenince özet eşleşmesi doğrulanır | Yanlış dosya yüklenirse özet uyuşmazlığı hatası |
| R6 | Özel faktör setlerinin lisansı yalnız kullanıcı onayına dayanıyor | Orta / Yüksek | Setler kiracıya özel taşınır, `rightsConfirmed` korunur; başka kiracıyla paylaşılamaz | Dış izinli danışman başka kiracının setini seçemez |
| R7 | Önceden hesaplanmış çıktılar ile motor sürümü değişimi | Orta / Orta | Çıktılar saklanmaz, yeniden hesaplanır; eşdeğerlik raporu v1 ve platform sonuçlarını yan yana koyar | Doğrulama paketi platformda da 16/16 |
| R8 | Kişisel veri (İSG olayları, ücret farkı) toplulaştırılmış ama küçük grup riski var | Düşük / Yüksek | İSG ve işgücü verileri yalnız toplam olarak taşınır; grup sayısı 5'in altındaysa ekranda gizlenir (KVKK; [DENETIM_RAPORLAMA_2026-10.md](../../DENETIM_RAPORLAMA_2026-10.md) §2.4) | 3 kişilik grup ekranda "—" görünür |
| R9 | Aynı dosyanın iki kez içe aktarılması | Orta / Düşük | Dosyanın SHA-256 özeti ile proje eşleşirse aktarım reddedilir ya da önceki kayda bağlanır | İkinci aktarım yeni kayıt üretmez |
| R10 | Göç sırasında veri kaybı | Düşük / Yüksek | Kaynak JSON salt okunur olarak arşivlenir; geri alma (rollback) aracı aktarılan projeyi siler | İleri, geri, ileri testi |

**Kabul:** Göç, kullanıcı önizlemeyi onaylamadan yazmaz. Yazdıktan sonra satır sayısı, değer eşdeğerliği ve özet raporu üretir (plan 06 §9.7).
