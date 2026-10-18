# Doğrulama sonuçları

Çalıştırma: 2026-10-18 · 16 vaka · 119 kontrol · 16 vaka geçti

| Vaka | Profil | Kaynak türü | Kontrol | Sonuç | En büyük göreli sapma | Süre |
|---|---|---|---|---|---|---|
| p1-local-producer-2024 | local | synthetic-official-factors | 14 | geçti | < 1e-9 | 0 ms |
| p2-cbam-exporter | cbam | synthetic-official-parameters | 36 | geçti | < 1e-9 | 1 ms |
| p3-revision-2023 | revision | synthetic-official-factors | 13 | geçti | < 1e-9 | 0 ms |
| p3-threshold-below-5pct | revision | synthetic | 3 | geçti | < 1e-9 | 0 ms |
| p3-threshold-exact-5pct | revision | synthetic | 3 | geçti | 0 | 0 ms |
| r-cbam-cement-5a | cbam | official-worked-example | 5 | geçti | 0.084 % | 0 ms |
| r-cbam-default-lookup-4 | cbam | official-worked-example | 8 | geçti | < 1e-9 | 0 ms |
| r-cbam-factor-table-4 | cbam | official-parameter-table | 9 | geçti | 0 | 0 ms |
| r-cbam-hydrogen-5b | cbam | official-worked-example | 5 | geçti | 0.0026 % | 0 ms |
| r-cbam-steel-rails-5d | cbam | official-worked-example | 5 | geçti | 0.14 % | 0 ms |
| r-epa-cccl-boiler | local | official-worked-example | 2 | geçti | 0.0058 % | 0 ms |
| r-epa-ghgrp-steel-dynamics-2023 | local | regulator-facility-record | 1 | geçti | 0.000020 % | 0 ms |
| r-ghgp-scope2-location | local | official-worked-example | 1 | geçti | 0.0020 % | 0 ms |
| r-ghgp-scope2-market | local | official-worked-example | 1 | geçti | 0 | 0 ms |
| s1-stress-mizan-10k | stress | synthetic | 7 | geçti | 0 | 99 ms |
| s2-reconcile-edges | stress | synthetic | 6 | geçti | 0 | 8 ms |

Hedef: kapanış kontrolünde sapma < %0,5. Sentetik vakaların toleransı 1e-9 (tam aritmetikle hesaplanmış beklenen değerler).
