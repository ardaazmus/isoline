import { route } from "@/server/http/api";
import { campaignTemplate } from "@/server/data/imports";
import { translate } from "@/i18n/core";
import { XLSX_MIME } from "@/lib/spreadsheet";

/** An XLSX with one row per open request to fill in and import back. */
export const GET = route({}, async ({ actor, params, req }) => {
  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "tr";
  const t = (k: string) => translate(lang, k);
  const buf = await campaignTemplate(actor, params.campaignId, { metric: t("pf.data.templateSheet"), name: (code) => t(`req.items.${code}`), headers: ["metric", t("pf.data.colName"), "facility", t("pf.data.colPeriod"), "line", "value", "unit", "quality", "note"] });
  return new Response(buf, { headers: { "content-type": XLSX_MIME, "content-disposition": `attachment; filename="veri-sablonu.xlsx"`, "cache-control": "no-store" } });
});
