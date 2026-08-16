import type { BookMarker, WellBrief } from "./fence";
import type { PadField } from "./types";

const AMP = String.fromCharCode(38) + "amp;";
const LT = String.fromCharCode(38) + "lt;";
const GT = String.fromCharCode(38) + "gt;";
const QUOT = String.fromCharCode(38) + "quot;";
const APOS = String.fromCharCode(38) + "#39;";

export function briefHtml(pad: PadField, brief: WellBrief[], markers: BookMarker[]) {
  const rows = brief
    .map(
      (b) => `<tr>
        <td>${b.wellId}</td>
        <td>${b.advisory}</td>
        <td>${b.rmse != null ? b.rmse.toFixed(2) : "—"}</td>
        <td>${Number.isFinite(b.last) ? b.last.toFixed(1) : "—"}</td>
        <td>${(b.keyFit * 100).toFixed(0)}</td>
        <td>${b.horizonMd != null ? b.horizonMd.toFixed(0) : "—"}</td>
        <td>${escapeHtml(b.reason)}</td>
      </tr>`,
    )
    .join("");
  const mks = markers.map((m) => `${m.name} @ TVT ${m.tvt.toFixed(1)} (GR ${m.gr.toFixed(0)})`).join(" · ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(pad.name)} · Horizon brief</title>
<style>
  body{margin:0;background:#0b0c0a;color:#ebe6d8;font:16px/1.5 "Source Sans 3",system-ui,sans-serif}
  main{max-width:880px;margin:0 auto;padding:48px 24px}
  h1{font-family:Newsreader,Georgia,serif;font-weight:500;font-size:42px;margin:0}
  p.k{letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:#8a8678}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-family:"IBM Plex Mono",monospace;font-size:13px}
  th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8678;padding:8px 6px}
  td{border-top:1px solid #26261f;padding:8px 6px}
  .muted{color:#8a8678}
</style></head><body><main>
  <p class="k">Horizon RWT · pad brief</p>
  <h1>${escapeHtml(pad.name)}</h1>
  <p class="muted">${pad.wells.length} wells · markers ${mks || "none"}</p>
  <table>
    <thead><tr><th>Well</th><th>Call</th><th>RMSE</th><th>Last</th><th>Key</th><th>Horizon</th><th>Note</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, QUOT).replace(/'/g, APOS);
}
