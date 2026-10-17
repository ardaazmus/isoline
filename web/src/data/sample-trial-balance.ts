/**
 * Sample trial balance for the sample client (SAMPLE DATA). Balanced, closing entries not yet made, net sales
 * 42,000 m TRY to match the sample's inventory, environment and taxonomy figures. 600 is listed with two
 * sub-accounts, as accounting software exports it, to show that sub-accounts are not counted twice.
 */
import { trialBalanceCsv } from "@/lib/trial-balance";

export const SAMPLE_TB_FILE = "ornek-mizan-2026.csv";
export const SAMPLE_TB_TITLE = "Anadolu Yassı Çelik A.Ş. — Mizan 01.01.2026 - 31.12.2026 (örnek veri)";

/** [code, name, debit total, credit total], TRY. */
export const SAMPLE_TB_ROWS: [string, string, number, number][] = [
  ["100", "Kasa", 46_000_000, 34_000_000],
  ["102", "Bankalar", 61_200_000_000, 57_750_000_000],
  ["120", "Alıcılar", 49_300_000_000, 42_500_000_000],
  ["150", "İlk Madde ve Malzeme", 31_400_000_000, 27_200_000_000],
  ["152", "Mamuller", 36_700_000_000, 33_800_000_000],
  ["250", "Arazi ve Arsalar", 1_100_000_000, 0],
  ["252", "Binalar", 5_400_000_000, 0],
  ["253", "Tesis, Makine ve Cihazlar", 39_350_000_000, 750_000_000],
  ["254", "Taşıtlar", 700_000_000, 60_000_000],
  ["255", "Demirbaşlar", 380_000_000, 0],
  ["257", "Birikmiş Amortismanlar (-)", 610_000_000, 20_410_000_000],
  ["258", "Yapılmakta Olan Yatırımlar", 3_350_000_000, 600_000_000],
  ["260", "Haklar", 210_000_000, 0],
  ["268", "Birikmiş Amortismanlar (-)", 0, 90_000_000],
  ["300", "Banka Kredileri", 6_200_000_000, 10_300_000_000],
  ["320", "Satıcılar", 38_900_000_000, 44_500_000_000],
  ["360", "Ödenecek Vergi ve Fonlar", 2_380_000_000, 2_800_000_000],
  ["400", "Banka Kredileri", 1_200_000_000, 11_000_000_000],
  ["500", "Sermaye", 0, 10_000_000_000],
  ["570", "Geçmiş Yıllar Kârları", 0, 12_832_000_000],
  ["600", "Yurt İçi Satışlar", 0, 24_000_000_000],
  ["600.01", "Yurt İçi Satışlar — sıcak haddelenmiş rulo", 0, 15_800_000_000],
  ["600.02", "Yurt İçi Satışlar — soğuk haddelenmiş sac", 0, 8_200_000_000],
  ["601", "Yurt Dışı Satışlar", 0, 18_600_000_000],
  ["602", "Diğer Gelirler", 0, 150_000_000],
  ["610", "Satıştan İadeler (-)", 520_000_000, 0],
  ["611", "Satış İskontoları (-)", 230_000_000, 0],
  ["620", "Satılan Mamuller Maliyeti (-)", 33_800_000_000, 0],
  ["631", "Pazarlama, Satış ve Dağıtım Giderleri (-)", 1_100_000_000, 0],
  ["632", "Genel Yönetim Giderleri (-)", 1_900_000_000, 0],
  ["660", "Kısa Vadeli Borçlanma Giderleri (-)", 1_400_000_000, 0],
];

export function sampleTrialBalanceCsv(): string {
  return trialBalanceCsv(SAMPLE_TB_ROWS, SAMPLE_TB_TITLE);
}
