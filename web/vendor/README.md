# Depoda tutulan paketler

## `xlsx-0.20.3.tgz` (SheetJS Community Edition)

- **Ne için:** Excel içe aktarma (mizan, envanter, göstergeler) ve şablon üretimi.
- **Kaynak:** SheetJS'in resmi dağıtımı, https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz. Lisans Apache-2.0.
- **Neden depoda:** SheetJS güncel sürümleri npm kaydında yayımlamıyor (npm'deki `xlsx` 0.18.5'te kalmış durumda). Bağımlılık doğrudan CDN adresine bağlıyken, CDN'e erişilemeyen ağlarda `npm install` tümüyle duruyordu. SheetJS bu tür ortamlar için paketin depoya konmasını öneriyor; bu, projenin "çevrimdışı önce" ilkesine de uygun.
- **Bütünlük:** `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`. Bu değer CDN'deki dosyanınkiyle aynı ve `package-lock.json` bu özeti doğrular.

**Güncelleme:**
1. Yeni sürümü aynı adres kalıbıyla indirin.
2. Dosyayı bu klasöre koyun ve `package.json` içindeki `file:vendor/...` yolunu değiştirin.
3. `npm install` çalıştırın.
4. Eski dosyayı silin.
