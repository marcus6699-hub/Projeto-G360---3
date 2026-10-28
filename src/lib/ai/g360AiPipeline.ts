/**
 * G360 Business — Complete AI Pipeline & Brand/GBP Intelligence Engine
 * Google AI Studio Agent — Isolated Module
 */

import { BusinessInput, buildHardenedGbpPrompt, generateNeutralFallbackText, detectDataContradictions, validateBusinessInputData } from "./promptHardening.ts";

export interface BrandIdentityProposal {
  logoConcept: string;
  colorPalettes: Array<{
    id: string;
    name: string;
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  }>;
  typography: {
    heading: string;
    body: string;
  };
}

export interface GbpPackageOutput {
  description750: string;
  descriptionCharCount: number;
  keywords20: string[];
  products6: Array<{ name: string; description: string; priceHint?: string; isPending?: boolean }>;
  posts11: Array<{ title: string; body: string; callToAction: string }>;
  imageSeoNames20: string[];
  isVerifiedFactual: boolean;
  warnings: string[];
}

export function generateBrandIdentityProposal(business: BusinessInput): BrandIdentityProposal {
  const category = (business.category || "comercio").toLowerCase();
  
  let palettes = [
    { id: "modern-blue", name: "Azul Corporativo & Confiança", primary: "#2563EB", secondary: "#1E40AF", accent: "#3B82F6", bg: "#F8FAFC" },
    { id: "emerald-trust", name: "Verde Crescimento & Saúde", primary: "#16A34A", secondary: "#15803D", accent: "#22C55E", bg: "#F0FDF4" },
    { id: "purple-luxe", name: "Lilás Premium & Inovação", primary: "#7C3AED", secondary: "#6D28D9", accent: "#8B5CF6", bg: "#F5F3FF" },
  ];

  if (/restaurante|gastronomia|alimento|lanchonete|sorvete/.test(category)) {
    palettes = [
      { id: "warm-food", name: "Vermelho Apetite & Sabor", primary: "#DC2626", secondary: "#991B1B", accent: "#F87171", bg: "#FEF2F2" },
      { id: "earth-gourmet", name: "Terracota & Conforto", primary: "#C2410C", secondary: "#9A3412", accent: "#EA580C", bg: "#FFF7ED" },
      { id: "fresh-green", name: "Verde Frescor & Natural", primary: "#15803D", secondary: "#166534", accent: "#22C55E", bg: "#F0FDF4" },
    ];
  } else if (/saude|clinica|odonto|medicin/.test(category)) {
    palettes = [
      { id: "clinical-blue", name: "Azul Clínico & Limpeza", primary: "#0284C7", secondary: "#0369A1", accent: "#38BDF8", bg: "#F0F9FF" },
      { id: "teal-health", name: "Verde Água & Bem-Estar", primary: "#0D9488", secondary: "#115E59", accent: "#14B8A6", bg: "#F0FDFA" },
      { id: "purple-calm", name: "Lilás Suave & Confiança", primary: "#7C3AED", secondary: "#5B21B6", accent: "#8B5CF6", bg: "#F5F3FF" },
    ];
  }

  return {
    logoConcept: `Logomarca minimalista e profissional para "${business.name}", destacando o segmento de ${business.category || "serviços"} com tipografia limpa e geométrica, ideal para favicon, avatar do Google Meu Negócio e sinalização.`,
    colorPalettes: palettes,
    typography: {
      heading: "Inter / Plus Jakarta Sans",
      body: "Inter / Roboto",
    },
  };
}

export function compileCompleteGbpPackage(business: BusinessInput, customDifferential?: string): GbpPackageOutput {
  const warnings: string[] = [];
  const contradiction = detectDataContradictions(business);
  if (contradiction.hasContradiction) {
    warnings.push(...contradiction.details);
  }

  const validation = validateBusinessInputData(business);
  if (!validation.isValid) {
    warnings.push(`Dados incompletos detectados: faltando [${validation.missingFields.join(", ")}]. O pacote foi gerado com base estritamente nos dados confirmados.`);
  }

  const name = business.name || "Empresa";
  const city = business.city || "localidade";
  const cat = business.category || "atividade comercial";

  // Strict 750 character description adhering to anti-hallucination rules
  let desc = `${name} atua no segmento de ${cat} em ${city}. Prestação de serviços e atendimento direcionado ao público local.`;
  if (business.services && business.services.length > 0) {
    desc += ` Especializada em: ${business.services.join(", ")}.`;
  }
  if (business.phone || business.whatsapp) {
    desc += ` Entre em contato pelo telefone ${business.phone || business.whatsapp}.`;
  }
  if (customDifferential) {
    desc += ` ${String(customDifferential).slice(0, 150)}`;
  }
  if (desc.length > 745) {
    desc = desc.slice(0, 742) + "...";
  }

  // Exactly 20 SEO keywords / terms
  const keywords20 = [
    `${cat} em ${city}`,
    `melhor ${cat} ${city}`,
    `${cat} perto de mim`,
    `especialista em ${cat} ${city}`,
    `orçamento ${cat} ${city}`,
    `empresa de ${cat} em ${city}`,
    `${name} ${city}`,
    `atendimento ${cat} ${city}`,
    `indicação de ${cat} ${city}`,
    `${cat} profissional ${city}`,
    `serviços de ${cat} ${city}`,
    `${cat} de confiança ${city}`,
    `contato ${cat} ${city}`,
    `onde encontrar ${cat} em ${city}`,
    `${cat} com bom atendimento ${city}`,
    `${cat} recomendada ${city}`,
    `agendamento ${cat} ${city}`,
    `suporte ${cat} ${city}`,
    `${cat} nota máxima ${city}`,
    `guia de ${cat} ${city}`,
  ];

  // Exact products based on real business items/services or flagged as pending if insufficient data
  const rawItems = Array.isArray(business.items) ? business.items : [];
  const rawServices = Array.isArray(business.services) ? business.services : [];
  
  const products6: Array<{ name: string; description: string; priceHint?: string; isPending?: boolean }> = [];
  
  // 1. Map actual items from business data
  for (let i = 0; i < Math.min(6, rawItems.length); i++) {
    const it = rawItems[i];
    products6.push({
      name: it.name || `Produto ${i + 1}`,
      description: it.description || `Item oficial do catálogo de ${name} em ${city}.`,
      priceHint: it.price || "Sob consulta",
      isPending: false,
    });
  }

  // 2. Map services as products if items are fewer than 6
  for (let i = rawItems.length; i < Math.min(6, rawItems.length + rawServices.length); i++) {
    const srvName = rawServices[i - rawItems.length];
    products6.push({
      name: String(srvName || `Serviço ${i + 1}`),
      description: `Serviço especializado prestado por ${name} em ${city}.`,
      priceHint: "Sob consulta",
      isPending: false,
    });
  }

  // 3. If still fewer than 6, mark pending catalog items clearly as requested by validation rules
  for (let i = products6.length; i < 6; i++) {
    products6.push({
      name: `[PENDENTE] Produto / Serviço #${i + 1} não cadastrado`,
      description: `Dados insuficientes fornecidos pela empresa para definir o item ${i + 1}. Necessário envio de catálogo pelo proprietário.`,
      priceHint: "Aguardando cadastro",
      isPending: true,
    });
    warnings.push(`Item de produto #${i + 1} pendente de cadastro real pelo proprietário.`);
  }

  // Exactly 11 posts
  const posts11 = Array.from({ length: 11 }, (_, i) => ({
    title: `Informações sobre ${cat} #${i + 1}`,
    body: `Conheça os serviços cadastrados de ${name} em ${city}. Consulte os canais oficiais para confirmar disponibilidade e atendimento.`,
    callToAction: "Saiba mais",
  }));

  // Exactly 20 image SEO names
  const imageSeoNames20 = Array.from({ length: 20 }, (_, i) => 
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${cat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${city.toLowerCase()}-foto-${i + 1}.jpg`
  );

  return {
    description750: desc,
    descriptionCharCount: desc.length,
    keywords20,
    products6,
    posts11,
    imageSeoNames20,
    isVerifiedFactual: false,
    warnings,
  };
}

/** Explicit adapter: local deterministic drafting only; never calls a paid provider. */
export function buildIntegratedGbpPackage(input: BusinessInput, customDifferential = "") {
  const business: BusinessInput = {
    ...input,
    name: typeof input?.name === "string" ? input.name.slice(0,160) : "",
    services: Array.isArray(input?.services) ? input.services.filter((s) => typeof s === "string").slice(0,30) : [],
    items: Array.isArray(input?.items) ? input.items.filter((it) => it && typeof it.name === "string" && !it.isPending && !it.name.includes("[PENDENTE]")).slice(0,30) : [],
  };
  if (!business.name.trim()) throw new Error("Informe a empresa antes de preparar o pacote.");
  const draft = compileCompleteGbpPackage(business, customDifferential);
  const services = (business.services || []).map((name) => ({name, category: business.category || "", localTerm: `${name} ${business.city || ""}`.trim(), description: `${name}. Consulte disponibilidade nos canais oficiais.`, isPending:false}));
  const products = draft.products6.map((it) => ({...it, category: business.category || "", priceLabel:it.priceHint || "Sob consulta"}));
  const posts = draft.posts11.map((it,i) => ({number:i+1,title:it.title,text:it.body,charCount:it.body.length,objective:"Informação",scheduledDate:"A definir",scheduledTime:"A definir",ctaType:it.callToAction,ctaPhone:business.phone || business.whatsapp || "",imageDirection:"Utilize foto própria autorizada; confirme o conteúdo antes da publicação."}));
  return {
    schemaVersion:1, businessName:business.name,city:business.city || "",uf:business.uf || "",phone:business.phone || business.whatsapp || "",
    primaryCategory:business.category || "", additionalCategories:[],description750:draft.description750,descriptionCharCount:draft.descriptionCharCount,
    services, products, posts, scheduledPosts:posts,photoSeoNames:draft.imageSeoNames20,localKeywords:draft.keywords20,
    branding:generateBrandIdentityProposal(business),warnings:draft.warnings,isVerifiedFactual:false,source:"local-draft",
    siteBriefing:{businessName:business.name,approvedServices:[],approvedProducts:[]},
  };
}
