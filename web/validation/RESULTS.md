# Doğrulama sonuçları

Çalıştırma: 2026-10-18 · 7 vaka · 82 kontrol · 7 vaka geçti

| Vaka | Profil | Kaynak türü | Kontrol | Sonuç | En büyük göreli sapma | Süre |
|---|---|---|---|---|---|---|
| p1-local-producer-2024 | local | synthetic-official-factors | 14 | geçti | < 1e-9 | 0 ms |
| p2-cbam-exporter | cbam | synthetic-official-parameters | 36 | geçti | < 1e-9 | 1 ms |
| p3-revision-2023 | revision | synthetic-official-factors | 13 | geçti | < 1e-9 | 0 ms |
| p3-threshold-below-5pct | revision | synthetic | 3 | geçti | < 1e-9 | 0 ms |
| p3-threshold-exact-5pct | revision | synthetic | 3 | geçti | 0 | 0 ms |
| s1-stress-mizan-10k | stress | synthetic | 7 | geçti | 0 | 101 ms |
| s2-reconcile-edges | stress | synthetic | 6 | geçti | 0 | 8 ms |

Hedef: kapanış kontrolünde sapma < %0,5. Sentetik vakaların toleransı 1e-9 (tam aritmetikle hesaplanmış beklenen değerler).
