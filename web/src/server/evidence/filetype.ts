/**
 * Upload gate (OWASP File Upload cheat sheet): an allow-list of evidence formats, checked by content signature and
 * not only by the name or the browser's MIME claim. The stored MIME is the detected one.
 */
export const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024;

export type Detected = { mime: string; ext: string[] };

const ZIP_MIMES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

function isText(b: Uint8Array): boolean {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, Math.min(b.length, 64 * 1024)));
    return true;
  } catch {
    // a multi-byte character cut at the 64 KB boundary is fine; retry on a shorter prefix
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, Math.min(b.length, 64 * 1024 - 4)));
      return true;
    } catch {
      return false;
    }
  }
}

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

/** Returns the detected type, or null when the content is not an allowed evidence format. */
export function detect(bytes: Uint8Array, filename: string): Detected | null {
  const ext = extensionOf(filename);
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: ["pdf"] };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: ["png"] };
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: ["jpg", "jpeg"] };
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: ["webp"] };
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const kind = ext in ZIP_MIMES ? ext : "zip";
    return { mime: ZIP_MIMES[kind], ext: [kind] };
  }
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { mime: ext === "doc" ? "application/msword" : "application/vnd.ms-excel", ext: ["xls", "doc"] };
  if (bytes.length > 0 && isText(bytes)) {
    if (ext === "csv") return { mime: "text/csv", ext: ["csv"] };
    if (ext === "json") return { mime: "application/json", ext: ["json"] };
    if (ext === "xml") return { mime: "application/xml", ext: ["xml"] };
    if (ext === "txt" || ext === "") return { mime: "text/plain", ext: ["txt"] };
    return null; // text under another extension (.html, .svg, .js…) is not evidence
  }
  return null;
}

/** Keeps the base name only, removes control and path characters, caps the length. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").replace(/^[\s.]+/, "").trimEnd();
  return (clean || "dosya").slice(0, 255).trimEnd();
}
