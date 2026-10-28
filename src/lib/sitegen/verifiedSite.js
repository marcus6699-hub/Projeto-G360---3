const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

/** Self-contained, deliberately modest export from explicitly approved facts. */
export function buildVerifiedSiteHtml(input) {
  const name = String(input.name || "").trim();
  if (!name || name.length > 160 || !input.approved) throw new Error("Aprove os dados antes de gerar o site.");
  const category = String(input.category || "").slice(0, 160);
  const city = String(input.city || "").slice(0, 160);
  const description = String(input.description || "").slice(0, 2000);
  const phone = String(input.phone || "").trim();
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
  const dial = /^[1-9][1-9]\d{8,9}$/.test(local) && !/^(\d)\1+$/.test(local.slice(2)) ? `55${local}` : null;
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#243b4a";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)}</title><meta name="description" content="${escapeHtml(description)}"><style>*{box-sizing:border-box}body{margin:0;color:#1b2630;font:16px/1.65 system-ui,sans-serif;background:#f7f7f3}header,main,footer{padding:24px max(24px,calc((100vw - 1100px)/2))}header{border-bottom:1px solid #dae0db;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}header strong{font-size:1.1rem}main{min-height:75vh;display:grid;align-content:center;gap:24px}small{text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:${color}}h1{font-size:clamp(2.5rem,7vw,6rem);line-height:1.04;letter-spacing:-.04em;max-width:14ch;margin:0}p{max-width:68ch;margin:0}a.button{display:inline-block;background:${color};color:#fff;padding:14px 22px;border-radius:4px;text-decoration:none;font-weight:700}footer{border-top:1px solid #dae0db;font-size:.9rem}@media(max-width:600px){header,main,footer{padding:22px}main{min-height:65vh}}</style></head><body><header><strong>${escapeHtml(name)}</strong><span>${escapeHtml(city)}</span></header><main><small>${escapeHtml(category)}</small><h1>${escapeHtml(name)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}${dial ? `<p><a class="button" href="tel:+${dial}">Ligar: ${escapeHtml(phone)}</a></p>` : ""}</main><footer>${escapeHtml(name)}${city ? ` · ${escapeHtml(city)}` : ""}</footer></body></html>`;
}

export async function downloadVerifiedSiteZip(input) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("index.html", buildVerifiedSiteHtml(input));
  zip.file("README.md", "Site estático com dados revisados. Abra index.html em um navegador ou hospede em um serviço estático. Não há API, fonte ou imagem externa. Revise os dados antes de publicar.\n");
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  try { const link = document.createElement("a"); link.href = url; link.download = "site-revisado.zip"; document.body.appendChild(link); link.click(); link.remove(); }
  finally { const timer = setTimeout(() => URL.revokeObjectURL(url), 30_000); timer?.unref?.(); }
}
