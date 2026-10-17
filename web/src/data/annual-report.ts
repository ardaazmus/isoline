/**
 * Annual (activity) report checklist. Item ids map to messages ar.items.<id> (title) and ar.hints.<id>.
 * Groups follow the Turkish minimum-content regulation (RG 28.08.2012, 28395) articles, then SPK and
 * BDDK additions and the EU Accounting Directive management-report items.
 */
export type ArItem = { id: string; group: string; ref: string; profiles: ("ttk" | "listed" | "bank")[]; source: string };

const all: ArItem["profiles"] = ["ttk", "listed", "bank"];
const listed: ArItem["profiles"] = ["listed"];

export const AR_ITEMS: ArItem[] = [
  { id: "principles", group: "general", ref: "Yön. md. 4–6", profiles: all, source: "ar_min_content" },
  { id: "period_identity", group: "general", ref: "Yön. md. 8", profiles: all, source: "ar_min_content" },
  { id: "organisation_capital", group: "general", ref: "Yön. md. 8", profiles: all, source: "ar_min_content" },
  { id: "privileged_shares", group: "general", ref: "Yön. md. 8", profiles: all, source: "ar_min_content" },
  { id: "board_staff", group: "general", ref: "Yön. md. 8", profiles: all, source: "ar_min_content" },
  { id: "competition_ban", group: "general", ref: "Yön. md. 8", profiles: all, source: "ar_min_content" },
  { id: "financial_rights", group: "rights", ref: "Yön. md. 9", profiles: all, source: "ar_min_content" },
  { id: "rnd", group: "activities", ref: "Yön. md. 10", profiles: all, source: "ar_min_content" },
  { id: "investments", group: "activities", ref: "Yön. md. 11/a", profiles: all, source: "ar_min_content" },
  { id: "internal_control", group: "activities", ref: "Yön. md. 11/b", profiles: all, source: "ar_min_content" },
  { id: "subsidiaries", group: "activities", ref: "Yön. md. 11/c", profiles: all, source: "ar_min_content" },
  { id: "own_shares", group: "activities", ref: "Yön. md. 11/ç", profiles: all, source: "ar_min_content" },
  { id: "audits", group: "activities", ref: "Yön. md. 11/d", profiles: all, source: "ar_min_content" },
  { id: "lawsuits", group: "activities", ref: "Yön. md. 11/e", profiles: all, source: "ar_min_content" },
  { id: "sanctions", group: "activities", ref: "Yön. md. 11/f", profiles: all, source: "ar_min_content" },
  { id: "targets_gm", group: "activities", ref: "Yön. md. 11/g", profiles: all, source: "ar_min_content" },
  { id: "extraordinary_gm", group: "activities", ref: "Yön. md. 11/ğ", profiles: all, source: "ar_min_content" },
  { id: "donations", group: "activities", ref: "Yön. md. 11/h", profiles: all, source: "ar_min_content" },
  { id: "group_transactions", group: "activities", ref: "Yön. md. 11/ı-i", profiles: all, source: "ar_min_content" },
  { id: "management_analysis", group: "financial", ref: "Yön. md. 12/a", profiles: all, source: "ar_min_content" },
  { id: "ratios", group: "financial", ref: "Yön. md. 12/b", profiles: all, source: "ar_min_content" },
  { id: "capital_loss", group: "financial", ref: "Yön. md. 12/c-ç", profiles: all, source: "ar_min_content" },
  { id: "dividend_policy", group: "financial", ref: "Yön. md. 12/d", profiles: all, source: "ar_min_content" },
  { id: "risk_policy", group: "risks", ref: "Yön. md. 13", profiles: all, source: "ar_min_content" },
  { id: "resk", group: "risks", ref: "Yön. md. 13 · TTK 378", profiles: all, source: "ar_min_content" },
  { id: "subsequent_events", group: "other", ref: "Yön. md. 14", profiles: all, source: "ar_min_content" },
  { id: "group_parent", group: "other", ref: "Yön. md. 15", profiles: all, source: "ar_min_content" },
  { id: "signatures", group: "other", ref: "Yön. md. 16 · TTK 514", profiles: all, source: "ar_min_content" },
  { id: "spk_timing", group: "spk", ref: "SPK II-14.1", profiles: listed, source: "spk_ii_14_1" },
  { id: "spk_urf_kybf", group: "spk", ref: "SPK II-17.1 · URF/KYBF", profiles: listed, source: "spk_cg_forms" },
  { id: "spk_sustainability", group: "spk", ref: "SPK Sürdürülebilirlik İlkeleri", profiles: listed, source: "spk_sust_template" },
  { id: "tsrs_link", group: "spk", ref: "TSRS 1 · KAP", profiles: ["listed", "bank"], source: "kgk_scope_decision" },
  { id: "bddk_content", group: "bank", ref: "BDDK Yön. (RG 26333)", profiles: ["bank"], source: "bddk_ar" },
  { id: "auditor_consistency", group: "audit", ref: "KGK duyurusu · TTK 397–402", profiles: all, source: "ar_min_content" },
];

export const AR_GROUPS = ["general", "rights", "activities", "financial", "risks", "other", "spk", "bank", "audit"] as const;
