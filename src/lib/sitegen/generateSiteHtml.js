// Monta o HTML completo e autossuficiente do site gerado (canvas + exportação).
// ATENÇÃO: Nenhuma seção possui cadeado bloqueado (fixed: false em todas, incluindo o Hero).
import { PALETTES, ALL_PALETTES, FONT_PAIRS, DEFAULT_FONT, SITE_TEMPLATES, buildCss, esc } from "./theme";
import * as S from "./sections";
import JSZip from "jszip";

export const ARCH_SECTIONS = {
  gastronomia: [
    { id: "hero", label: "Hero Fotográfico", fixed: false },
    { id: "quickstrip", label: "Atalho Rápido", fixed: false },
    { id: "menu", label: "Cardápio Categorizado", fixed: false },
    { id: "steps", label: "Como Funciona", fixed: false },
    { id: "promo", label: "Promoção com Cronômetro", fixed: false },
    { id: "spotlight", label: "Destaque Giratório", fixed: false },
    { id: "video", label: "Vídeo Institucional", fixed: false },
    { id: "about", label: "Sobre Nós", fixed: false },
    { id: "gallery", label: "Galeria / Por Dentro", fixed: false },
    { id: "reviews", label: "Avaliações do Google", fixed: false },
    { id: "location", label: "Localização & Rotas", fixed: false },
    { id: "faq", label: "Dúvidas Frequentes", fixed: false },
  ],
  servicos: [
    { id: "hero", label: "Hero Editorial", fixed: false },
    { id: "bento", label: "Vitrine de Serviços / Especialidades", fixed: false },
    { id: "gallery", label: "Galeria / Por Dentro", fixed: false },
    { id: "steps", label: "Como Funciona (Etapas)", fixed: false },
    { id: "promo", label: "Promoção com Cronômetro", fixed: false },
    { id: "authority", label: "Sobre / Autoridade & Números", fixed: false },
    { id: "video", label: "Vídeo Institucional", fixed: false },
    { id: "reviews", label: "Avaliações do Google", fixed: false },
    { id: "location", label: "Localização & Rotas", fixed: false },
    { id: "faq", label: "Dúvidas Frequentes", fixed: false },
  ],
  produtos: [
    { id: "hero", label: "Hero Vitrine", fixed: false },
    { id: "catalog", label: "Catálogo de Produtos", fixed: false },
    { id: "gallery", label: "Galeria / Por Dentro", fixed: false },
    { id: "steps", label: "Como Funciona", fixed: false },
    { id: "promo", label: "Promoção com Cronômetro", fixed: false },
    { id: "video", label: "Vídeo Institucional", fixed: false },
    { id: "about", label: "Sobre a Loja", fixed: false },
    { id: "reviews", label: "Avaliações do Google", fixed: false },
    { id: "location", label: "Localização & Rotas", fixed: false },
    { id: "faq", label: "Dúvidas Frequentes", fixed: false },
  ],
};

export function defaultSections(arch) {
  const off = new Set(["promo", "video"]);
  return (ARCH_SECTIONS[arch] || ARCH_SECTIONS.produtos).map((s) => ({
    id: s.id,
    on: !off.has(s.id),
  }));
}

const SECTION_RENDERERS = {
  hero: (ctx) => S.hero(ctx),
  quickstrip: (ctx) => S.quickstrip(ctx),
  menu: (ctx) => S.menu(ctx),
  catalog: (ctx) => S.catalog(ctx),
  spotlight: (ctx) => S.spotlight(ctx),
  about: (ctx) => S.about(ctx),
  gallery: (ctx) => S.gallery(ctx),
  bento: (ctx) => S.bento(ctx),
  steps: (ctx) => S.steps(ctx),
  authority: (ctx) => S.authority(ctx),
  promo: (ctx) => S.promo(ctx),
  video: (ctx) => S.video(ctx),
  reviews: (ctx) => S.reviews(ctx),
  location: (ctx) => S.location(ctx),
  faq: (ctx) => S.faq(ctx),
};

const BACKEND = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_BACKEND_URL || "" : "";
export const absUrl = (u) => (typeof u === "string" && u.startsWith("/api/") ? BACKEND + u : u);

function normalizeBusiness(b) {
  return {
    ...b,
    photos: (b.photos || []).map(absUrl),
    items: (b.items || []).map((it) => ({ ...it, image: absUrl(it.image) })),
  };
}

export function buildCtx(data) {
  const arch = data.archetype || "produtos";
  const defaultTpl = arch === "gastronomia" ? "simprao" : arch === "servicos" ? "atelie-val" : "vitrine-express";
  const templateId = data.templateId || defaultTpl;
  const tplDef = SITE_TEMPLATES.find((t) => t.id === templateId);
  const palList = PALETTES[arch] || PALETTES.produtos;
  const foundPal = ALL_PALETTES.find((p) => p.id === (data.paletteId || tplDef?.paletteId)) || palList[0];
  const pal = foundPal.vars;
  const font =
    FONT_PAIRS.find((f) => f.id === (data.fontId || tplDef?.fontId)) ||
    FONT_PAIRS.find((f) => f.id === DEFAULT_FONT[arch]) ||
    FONT_PAIRS[0];
  return {
    b: normalizeBusiness(data.business),
    arch,
    templateId,
    pal,
    font,
    logo: data.logo || null,
    promo: data.promo || {},
    video: data.video || { url: "" },
    buttons: data.buttons || {},
    t: (key, fallback) => (data.texts && data.texts[key] != null ? data.texts[key] : fallback),
    img: (id, fallback) => {
      const o = (data.images || {})[id];
      return {
        url: absUrl((o && o.url) || fallback),
        fit: (o && o.fit) || "cover",
      };
    },
  };
}

function seoHead(data, ctx) {
  const b = ctx.b;
  const m = data.marketing || {};
  const title = m.seoTitle || `${b.name} | ${b.category} em ${b.city}${b.uf ? " - " + b.uf : ""}`;
  const desc = m.seoDesc || (b.bio || "").slice(0, 155);
  const type = data.archetype === "gastronomia" ? "FoodEstablishment" : data.archetype === "servicos" ? "MedicalBusiness" : "LocalBusiness";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": type,
    name: b.name,
    description: desc,
    telephone: b.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address,
      addressLocality: b.city,
      addressRegion: b.uf,
      addressCountry: "BR",
    },
    geo: b.lat && b.lng ? { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating ? { "@type": "AggregateRating", ratingValue: b.rating, reviewCount: b.rating_count || 0 } : undefined,
    image: (b.photos || [])[0],
    openingHours: b.hours_text || undefined,
  };
  Object.keys(jsonLd).forEach((k) => jsonLd[k] === undefined && delete jsonLd[k]);
  return `
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${esc((b.photos || [])[0] || "")}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(m.canonical || "")}">
${m.gsc ? `<meta name="google-site-verification" content="${esc(m.gsc)}">` : ""}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

function pixelScripts(data) {
  const m = data.marketing || {};
  let out = "";
  if (m.metaPixelId) {
    out += `
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(m.metaPixelId)}');fbq('track','PageView');</script>`;
  }
  if (m.ga4Id || m.gadsId) {
    const gid = m.gadsId || m.ga4Id;
    out += `
<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gid)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());${m.gadsId ? `gtag('config','${esc(m.gadsId)}');` : ""}${m.ga4Id ? `gtag('config','${esc(m.ga4Id)}');` : ""}</script>`;
  }
  if (m.gtmId) {
    out += `
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${esc(m.gtmId)}');</script>`;
  }
  return out;
}

function gtmBody(data) {
  const m = data.marketing || {};
  return m.gtmId
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(m.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
    : "";
}

function interactionScript(data, editor, trackUrl) {
  const m = data.marketing || {};
  return `
<script>
(function(){
  var TRACK=${JSON.stringify(trackUrl || "")};
  function track(btn){if(!TRACK)return;try{var body=JSON.stringify({button:btn||'outro',page:location.href});
    if(navigator.sendBeacon){navigator.sendBeacon(TRACK,new Blob([body],{type:'text/plain'}))}
    else{fetch(TRACK,{method:'POST',body:body,keepalive:true,headers:{'Content-Type':'text/plain'}})}}catch(e){}}
  // Reveal on scroll
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
  document.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el)});
  // Filtros de pílulas
  var pills=document.querySelectorAll('.pill[data-filter]');
  pills.forEach(function(p){p.addEventListener('click',function(){
    pills.forEach(function(x){x.classList.remove('on')});p.classList.add('on');
    var f=p.getAttribute('data-filter');
    document.querySelectorAll('.card-item').forEach(function(c){
      c.style.display=(f==='all'||c.getAttribute('data-cat')===f)?'':'none';
    });
  })});
  // Atalhos rápidos
  document.querySelectorAll('[data-quickfilter]').forEach(function(q){q.addEventListener('click',function(){
    var mode=q.getAttribute('data-quickfilter');
    var all=document.querySelector('.pill[data-filter="all"]');if(all)all.click();
    if(mode==='top'){document.querySelectorAll('.card-item').forEach(function(c){if(c.getAttribute('data-top')!=='1')c.style.display='none'})}
    var t=document.getElementById('cardapio')||document.getElementById('catalogo');if(t)t.scrollIntoView({behavior:'smooth'});
  })});
  // Spotlight
  document.querySelectorAll('[data-spotcar]').forEach(function(car){
    var imgs=car.querySelectorAll('img'),i=0;
    if(!imgs.length)return;
    function go(d){imgs[i].classList.remove('on');i=(i+d+imgs.length)%imgs.length;imgs[i].classList.add('on')}
    var p=car.querySelector('[data-spotprev]'),n=car.querySelector('[data-spotnext]');
    if(p)p.addEventListener('click',function(){go(-1)});if(n)n.addEventListener('click',function(){go(1)});
    setInterval(function(){go(1)},5200);
  });
  // Carrossel de avaliações
  var track=document.querySelector('[data-revtrack]');
  if(track){
    var step=function(){var c=track.querySelector('.rev-card');return c?c.offsetWidth+20:320};
    var pv=document.querySelector('[data-revprev]'),nx=document.querySelector('[data-revnext]');
    if(pv)pv.addEventListener('click',function(){track.scrollBy({left:-step(),behavior:'smooth'})});
    if(nx)nx.addEventListener('click',function(){track.scrollBy({left:step(),behavior:'smooth'})});
  }
  // Galeria + lightbox
  var lb=document.querySelector('[data-lightbox]');
  document.querySelectorAll('[data-gal]').forEach(function(tab){tab.addEventListener('click',function(){
    document.querySelectorAll('[data-gal]').forEach(function(x){x.classList.remove('on')});tab.classList.add('on');
    var prod=tab.getAttribute('data-gal')==='produtos';
    var gp=document.querySelector('[data-galprod]'),ge=document.querySelector('[data-galesp]');
    if(gp)gp.style.display=prod?'grid':'none';if(ge)ge.style.display=prod?'none':'grid';
  })});
  if(lb){
    var lbi=lb.querySelector('img');
    document.querySelectorAll('.gal figure').forEach(function(f){f.addEventListener('click',function(){lbi.src=f.querySelector('img').src;lb.classList.add('open')})});
    lb.addEventListener('click',function(){lb.classList.remove('open')});
  }
  // Vídeo
  document.querySelectorAll('[data-videoplay]').forEach(function(cov){cov.addEventListener('click',function(){
    var src=cov.getAttribute('data-videoplay');if(!src)return;
    var fr=document.createElement('iframe');fr.src=src;fr.allow='autoplay;fullscreen';fr.allowFullscreen=true;
    cov.replaceWith(fr);
  })});
  // Cronômetro
  document.querySelectorAll('[data-countdown]').forEach(function(cd){
    var end=new Date(cd.getAttribute('data-countdown')).getTime();
    var h=cd.querySelector('[data-cd-h]'),m2=cd.querySelector('[data-cd-m]'),s=cd.querySelector('[data-cd-s]');
    function tick(){var d=Math.max(0,end-Date.now());var hh=Math.floor(d/3.6e6),mm=Math.floor(d%3.6e6/6e4),ss=Math.floor(d%6e4/1e3);
      if(h)h.textContent=String(hh).padStart(2,'0');if(m2)m2.textContent=String(mm).padStart(2,'0');if(s)s.textContent=String(ss).padStart(2,'0')}
    tick();setInterval(tick,1000);
  });
  // Barra WhatsApp mobile
  var bar=document.querySelector('.wa-bar');
  if(bar){var toggle=function(){bar.classList.toggle('show',window.scrollY>window.innerHeight*.6)};window.addEventListener('scroll',toggle,{passive:true});toggle()}
  // Eventos de conversão (Meta Pixel / Google Ads)
  document.querySelectorAll('a[data-wa]').forEach(function(a){a.addEventListener('click',function(){
    track(a.getAttribute('data-btn')||((a.getAttribute('href')||'').indexOf('tel:')===0?'telefone':'outro'));
    try{if(window.fbq)fbq('track','Contact')}catch(e){}
    try{if(window.gtag){${m.gadsId && m.gadsLabel ? `gtag('event','conversion',{send_to:'${m.gadsId}/${m.gadsLabel}'});` : ""}gtag('event','whatsapp_click',{event_category:'contato'})}}catch(e){}
  })});
  ${
    editor
      ? `
  // ---- Ponte do editor visual limpa (sem linhas intrusivas) ----
  document.addEventListener('click',function(e){
    var t=e.target.closest('a');if(t){e.preventDefault()}
    var b=e.target.closest('[data-btn]');
    if(b&&!e.target.closest('[data-edit]')){e.preventDefault();parent.postMessage({__sxp:1,type:'inspect-button',id:b.getAttribute('data-btn')},'*');return}
    var im=e.target.closest('[data-img]');
    if(im){e.preventDefault();parent.postMessage({__sxp:1,type:'inspect-image',id:im.getAttribute('data-img')},'*')}
  },true);

  document.querySelectorAll('[data-edit]').forEach(function(el){
    el.setAttribute('contenteditable','true');el.setAttribute('spellcheck','false');
    el.style.outline='none';
    el.style.cursor='text';
    el.addEventListener('focus',function(){
      el.style.boxShadow='0 0 0 2px rgba(59,130,246,0.6)';
      el.style.borderRadius='4px';
    });
    el.addEventListener('blur',function(){
      el.style.boxShadow='';
      parent.postMessage({__sxp:1,type:'edit',key:el.getAttribute('data-edit'),value:el.textContent},'*');
    });
    el.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();el.blur()}});
  });
  `
      : ""
  }
})();
</script>`;
}

export function generateSiteHtml(data, opts = {}) {
  const editor = !!opts.editor;
  const trackUrl = !editor && opts.slug ? `${BACKEND}/api/public/track/${opts.slug}` : "";
  const ctx = buildCtx(data);
  const sections = (data.sections || defaultSections(data.archetype)).filter((s) => s.on);
  const body = sections.map((s) => (SECTION_RENDERERS[s.id] ? SECTION_RENDERERS[s.id](ctx) : "")).join("\n");
  const font = ctx.font;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${seoHead(data, ctx)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${font.google}&display=swap" rel="stylesheet">
<script>window.tailwind={config:{corePlugins:{preflight:false}}};</script>
<script src="https://cdn.tailwindcss.com"></script>
<style>${buildCss(ctx.pal, font, data.archetype, ctx.templateId)}</style>
${pixelScripts(data)}
</head>
<body class="arch-${data.archetype} tpl-${ctx.templateId}">
${gtmBody(data)}
${data.archetype === "produtos" ? S.topbar(ctx) : ""}
${S.header(ctx)}
${body}
${S.bottomShell(ctx)}
${interactionScript(data, editor, trackUrl)}
</body>
</html>`;
}

export function suspendedHtml(name) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} — Indisponível</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:Inter,sans-serif}svg{width:30px;height:30px}</style></head>
<body><div class="susp"><div class="susp-in">
<div class="ic"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
<h1>Site temporariamente indisponível</h1>
<p>O site de <b>${esc(name)}</b> está fora do ar no momento. Entre em contato com a administração para renovação ou mais informações.</p>
</div></div>
<style>.susp{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0f0e;color:#fff;text-align:center;padding:24px}.susp-in{max-width:440px;display:flex;flex-direction:column;gap:16px;align-items:center}.susp .ic{width:66px;height:66px;border-radius:20px;background:rgba(255,255,255,.08);display:grid;place-items:center;color:#f3c94d}.susp h1{font-size:26px;letter-spacing:-.03em;margin:0}.susp p{color:rgba(255,255,255,.6);font-size:14.5px;line-height:1.7;margin:0}</style>
</body></html>`;
}

export function downloadHtml(data, filename, slug) {
  const html = generateSiteHtml(data, { editor: false, slug });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSiteZip(data, filename, slug) {
  const zip = new JSZip();
  const html = generateSiteHtml(data, { editor: false, slug });
  zip.file("index.html", html);
  zip.file("README.md", "# " + (data.business?.name || "Site Express") + "\n" +
"Este site foi gerado pelo **Site Express Studio Pro**.\n" +
"Ele é 100% autossuficiente e pode ser hospedado em qualquer provedor estático:\n" +
"- Vercel: basta arrastar esta pasta\n" +
"- Netlify / Cloudflare Pages / GitHub Pages\n" +
"- Servidor cPanel, Nginx ou Apache\n\n" +
"## Arquivos:\n" +
"- index.html: Código completo do site com estilos embutidos e scripts de conversão.\n" +
"- site-manifest.json: Informações e configurações do projeto.\n");
  zip.file("site-manifest.json", JSON.stringify({
    name: data.business?.name || "",
    category: data.business?.category || "",
    phone: data.business?.phone || data.business?.whatsapp || "",
    city: data.business?.city || "",
    uf: data.business?.uf || "",
    exportedAt: new Date().toISOString()
  }, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || "site").replace(/\.html$/i, "") + ".zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
