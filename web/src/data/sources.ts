/**
 * Source register: every threshold, factor, date and rule shown in the product points to one of these.
 * confidence: "official" = read in the official text; "secondary" = seen only in secondary sources
 * (law-firm notes, news); "unverified" = reference value not re-verified against the primary text.
 * asOf = the date this record was last checked. Citations are proper names and stay untranslated.
 */
export type Confidence = "official" | "secondary" | "unverified";
export type Jurisdiction = "TR" | "EU" | "GLOBAL";

export type Source = {
  id: string;
  cite: string;
  url: string;
  jurisdiction: Jurisdiction;
  confidence: Confidence;
  asOf: string;
};

const AS_OF = "2026-10-17";

const list: Source[] = [
  // Türkiye
  { id: "kgk_scope_2026", cite: "KGK Kurul Kararı 13.01.2026 / 01-39092 (RG 16.01.2026, 33139)", url: "https://www.resmigazete.gov.tr/eskiler/2026/01/20260116-1.htm", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "kgk_scope_decision", cite: "KGK — TSRS Uygulama Kapsamına İlişkin Kurul Kararı (16.12.2024 değişikliğiyle)", url: "https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Kurul%20Kararlar%C4%B1/TMS%20Kurul%20Kararlar%C4%B1/T%C3%BCrkiye%20S%C3%BCrd%C3%BCr%C3%BClebilirlik%20Raporlama%20Standartlar%C4%B1n%C4%B1n%20Uygulama%20Kapsam%C4%B1na%20ili%C5%9Fkin%20Kurul%20Karar%C4%B1.pdf", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "kgk_relief_ext", cite: "KGK Kararı 25.12.2025 (RG 30.12.2025, 33123) — TSRS 1 E4/E5/E6(b) uzatması", url: "https://www.resmigazete.gov.tr/eskiler/2025/12/20251230.htm", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "kgk_decision_tree", cite: "KGK — Sürdürülebilirlik Raporlaması Yapmak Zorunda mıyım?", url: "https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Duyuru/KAPSAM(1).pdf", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "tsrs1", cite: "TSRS 1 — Sürdürülebilirlikle İlgili Finansal Bilgilerin Açıklanmasına İlişkin Genel Hükümler", url: "https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/RaporlamaStandarti/TSRS%201.pdf", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "tsrs2", cite: "TSRS 2 — İklimle İlgili Açıklamalar", url: "https://kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Duyuru/(KaynaklarIslenmis)_TSRS%202.pdf", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "tsrs2_amend", cite: "TSRS 2 sera gazı değişiklikleri (RG 28.07.2026, 33323)", url: "https://www.resmigazete.gov.tr/eskiler/2026/07/20260728.htm", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "kgk_assurance", cite: "Sürdürülebilirlik güvence denetimi (RG 05.09.2024, 32653)", url: "https://www.resmigazete.gov.tr/eskiler/2024/09/20240905.htm", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "climate_law", cite: "7552 sayılı İklim Kanunu (RG 09.07.2025, 32951)", url: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.7552.pdf", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "tr_ets_reg", cite: "Türkiye Emisyon Ticaret Sistemi Yönetmeliği (RG 27.08.2026, 33353)", url: "https://www.resmigazete.gov.tr/eskiler/2026/08/20260827-7.htm", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "kpk_2026_1", cite: "Karbon Piyasası Kurulu KPK/2026/1 pilot dönem kararları (03.09.2026)", url: "https://iklim.gov.tr/tr-ets-pilot-uygulama-donemine-yonelik-karbon-piyasasi-kurulu-toplanti-kararlarina-kpk-2026-1-iliskin-duyuru-duyuru-45", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "etkb_ef_2023", cite: "ETKB Türkiye Elektrik Üretim-Tüketim Noktası Emisyon Faktörleri, 2023 (yayım 26.12.2025)", url: "https://enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "ndc3", cite: "Türkiye NDC 3.0 (10.11.2025) — 2035: ≤643 MtCO₂e; 2053 net sıfır", url: "https://www.iklim.gov.tr/en/turkiye-submits-its-second-nationally-determined-contribution-to-the-united-nations-news-4640", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "tr_taxonomy", cite: "Türkiye Yeşil Taksonomisi Yönetmeliği (RG 24.09.2026, 33380)", url: "https://www.esin.av.tr/2026/09/29/turkiye-publishes-green-taxonomy-regulation/", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "ttk", cite: "6102 sayılı TTK md. 514, 516", url: "https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6102.pdf", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "ar_min_content", cite: "Şirketlerin Yıllık Faaliyet Raporunun Asgari İçeriğinin Belirlenmesi Hakkında Yönetmelik (RG 28.08.2012, 28395)", url: "https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=16547&MevzuatTertip=5", jurisdiction: "TR", confidence: "official", asOf: AS_OF },
  { id: "spk_ii_14_1", cite: "SPK II-14.1 Sermaye Piyasasında Finansal Raporlamaya İlişkin Esaslar Tebliği", url: "https://spk.gov.tr/duyurular/basin-duyurulari/2013/sermaye-piyasasinda-finansal-raporlamaya-iliskin-esaslar-tebligine-iliskin-basin-duyurusu", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "spk_cg_forms", cite: "SPK Kurumsal Yönetim URF ve KYBF (karar 10.01.2019, 2/49)", url: "https://spk.gov.tr/duyurular/basin-duyurulari/2019/kurumsal-yonetim-uyum-raporlamasi-hakkinda-duyuru", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "spk_sust_template", cite: "SPK Sürdürülebilirlik İlkeleri Uyum Çerçevesi ve KAP şablonu (karar 23.06.2022, 34/977)", url: "https://spk.gov.tr/surdurulebilirlik", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "bddk_ar", cite: "BDDK — Bankalarca Yıllık Faaliyet Raporu Hazırlanmasına İlişkin Yönetmelik (RG 01.11.2006, 26333)", url: "https://www.bddk.org.tr/Mevzuat/Liste/137", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "spk_green_guides", cite: "SPK Yeşil, Sürdürülebilir ve Sosyal / Sürdürülebilirlik Bağlantılı Sermaye Piyasası Araçları Rehberleri (13.08.2026)", url: "https://spk.gov.tr/duyurular/basin-duyurulari/2026/yesil-surdurulebilir-ve-sosyal-sermaye-piyasasi-araclari-rehberi-ve-surdurulebilirlik-baglantili-sermaye-piyasasi-araclari-rehberi-basin-duyurusu", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },
  { id: "energy_eff_reg", cite: "Enerji Verimliliği Yönetmeliği (RG 27.10.2011, 28097) — 1.000 TEP eşiği", url: "https://enerji.gov.tr", jurisdiction: "TR", confidence: "secondary", asOf: AS_OF },

  // AB
  { id: "cbam_reg", cite: "Regulation (EU) 2023/956 (CBAM), as amended by (EU) 2025/2083", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "cbam_price", cite: "European Commission — Price of CBAM certificates", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "cbam_guidance3", cite: "CBAM Guidance No. 3 (14.08.2026) — default value mark-ups", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "cbam_defaults", cite: "Implementing Regulation (EU) 2025/2621, corrected by (EU) 2026/1740 — default values", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "cbam_faa", cite: "Implementing Regulation (EU) 2025/2620 — free allocation adjustment benchmarks", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "cbam_factor", cite: "Regulation (EU) 2023/956 Art. 31; Directive 2003/87/EC Art. 10a(1a) — CBAM factor schedule", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "cbam_deduction_draft", cite: "Draft implementing rules on carbon price deduction (13.05.2026) — not adopted", url: "https://www.globalelr.com/2026/06/european-commission-publishes-draft-implementing-rules-on-cbam-carbon-price-deductions/", jurisdiction: "EU", confidence: "unverified", asOf: AS_OF },
  { id: "cbam_downstream", cite: "COM(2025) 989 — CBAM downstream extension proposal", url: "https://www.mayerbrown.com/en/insights/publications/2026/10/eus-cbam-downstream-extension-and-anti-circumvention-amendments-the-road-to-trilogue", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "csrd_omnibus", cite: "Directive (EU) 2026/470 (Omnibus I) — CSRD/CSDDD amendments", url: "https://eur-lex.europa.eu/eli/dir/2026/470/oj", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "stop_clock", cite: "Directive (EU) 2025/794 (Stop-the-Clock)", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32025L0794", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "esrs_2026", cite: "Delegated Regulation (EU) 2026/1563 — revised ESRS", url: "https://eur-lex.europa.eu/eli/reg_del/2026/1563/oj", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "vss_2026", cite: "Delegated Regulation (EU) 2026/1560 — voluntary sustainability reporting standard (value-chain cap)", url: "https://eur-lex.europa.eu/eli/reg_del/2026/1560/oj/eng", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "taxonomy_2026_73", cite: "Delegated Regulation (EU) 2026/73 — Taxonomy simplification", url: "https://eur-lex.europa.eu/eli/reg_del/2026/73/oj/eng", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "eudr", cite: "Regulation (EU) 2023/1115 (EUDR), as amended by (EU) 2025/2650", url: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "ecgt", cite: "Directive (EU) 2024/825 (Empowering Consumers for the Green Transition)", url: "https://eur-lex.europa.eu/eli/dir/2024/825/oj", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "espr_dpp", cite: "Regulation (EU) 2024/1781 (ESPR) — Digital Product Passport registry (Impl. Reg. 2026/1778)", url: "https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "battery_reg", cite: "Regulation (EU) 2023/1542 — battery passport", url: "https://eur-lex.europa.eu/eli/reg/2023/1542/oj", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "ets2", cite: "EU ETS2 start postponed to 2028", url: "https://icapcarbonaction.com/en/news/eu-officially-adopts-2040-climate-target-postpones-ets-2-one-year", jurisdiction: "EU", confidence: "secondary", asOf: AS_OF },
  { id: "esrs_xbrl", cite: "EFRAG draft ESRS XBRL taxonomy (17.09.2026)", url: "https://www.efrag.org/en/news-and-calendar/news/efrag-releases-draft-esrs-xbrl-taxonomy-for-the-revised-esrs-and-launches-public-consultation", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
  { id: "acc_directive", cite: "Directive 2013/34/EU (Accounting Directive) Art. 19, 19a, 20, 29, 34", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32013L0034", jurisdiction: "EU", confidence: "official", asOf: AS_OF },

  // Küresel
  { id: "ghg_protocol", cite: "GHG Protocol Corporate Standard & Scope 2 Guidance", url: "https://ghgprotocol.org/calculation-tools-and-guidance", jurisdiction: "GLOBAL", confidence: "official", asOf: AS_OF },
  { id: "ghg_revision", cite: "GHG Protocol / ISO unified corporate standard plan (29.07.2026)", url: "https://ghgprotocol.org/ghg-protocol-standards-and-guidance-update-process", jurisdiction: "GLOBAL", confidence: "official", asOf: AS_OF },
  { id: "ipcc_2006", cite: "IPCC 2006 Guidelines, Vol. 2, Tables 1.2 & 1.4 (default NCV and CO₂ factors)", url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html", jurisdiction: "GLOBAL", confidence: "unverified", asOf: AS_OF },
  { id: "ipcc_ar6_gwp", cite: "IPCC AR6 WG1, Table 7.SM.7 — GWP100", url: "https://www.ipcc.ch/report/ar6/wg1/", jurisdiction: "GLOBAL", confidence: "unverified", asOf: AS_OF },
  { id: "sbti_criteria", cite: "SBTi Corporate Near-Term Criteria (1.5°C: ≥4.2%/yr S1+2; WB2C: ≥2.5%/yr S3) & Net-Zero Standard V1.3", url: "https://sciencebasedtargets.org/standards-and-guidance", jurisdiction: "GLOBAL", confidence: "unverified", asOf: AS_OF },
  { id: "sbti_v2", cite: "SBTi Corporate Net-Zero Standard V2.0 (published 11.06.2026, effective 31.01.2027)", url: "https://sciencebasedtargets.org/news/the-sbti-releases-corporate-net-zero-standard-v2-0-to-accelerate-corporate-climate-action", jurisdiction: "GLOBAL", confidence: "official", asOf: AS_OF },
  { id: "gri_standards", cite: "GRI Standards (GRI 1/2/3; GRI 101 from 2026; GRI 102 & 103 from 2027)", url: "https://www.globalreporting.org/standards/standards-development/", jurisdiction: "GLOBAL", confidence: "official", asOf: AS_OF },
  { id: "ifrs_s2", cite: "IFRS S2 Climate-related Disclosures (amendments 11.12.2025, effective 2027)", url: "https://www.ifrs.org", jurisdiction: "GLOBAL", confidence: "secondary", asOf: AS_OF },
  { id: "cdp_2026", cite: "CDP 2026 disclosure cycle", url: "https://cdp.net/en/guidance", jurisdiction: "GLOBAL", confidence: "secondary", asOf: AS_OF },
  { id: "osha_rates", cite: "Safety rate conventions: LTIFR per 1,000,000 hours; TRIR per 200,000 hours (GRI 403-9 allows either base)", url: "https://www.globalreporting.org/standards/", jurisdiction: "GLOBAL", confidence: "unverified", asOf: AS_OF },
  { id: "esrs_topics", cite: "ESRS topical standards E1–E5, S1–S4, G1 (Delegated Reg. 2023/2772; revised by 2026/1563)", url: "https://eur-lex.europa.eu/eli/reg_del/2026/1563/oj", jurisdiction: "EU", confidence: "official", asOf: AS_OF },
];

export const SOURCES: Record<string, Source> = Object.fromEntries(list.map((s) => [s.id, s]));

export function source(id: string): Source {
  const s = SOURCES[id];
  if (!s) throw new Error(`Unknown source id: ${id}`);
  return s;
}
