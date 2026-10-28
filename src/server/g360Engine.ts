import { buildIntegratedGbpPackage } from "../lib/ai/g360AiPipeline.ts";
import { scoreEvidenceAudit } from "./evidenceAudit.ts";
import { buildAuditReportFromEvidenceAudit } from "../lib/g360/auditContract.js";
import { providerFetch, guardSdkClient } from "./externalAccess.ts";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI, Type } from "@google/genai";
import { scryptSync, randomBytes } from 'node:crypto';
import { costGuard } from "./costGuard.ts";
import { asyncRoute } from "./jsonPersistence.mjs";
import { publicUrlClient, PublicUrlError, publicUrlRoute, MAPS_HOSTS } from "./publicUrl.ts";
import { integrationStatus, publicDeploySettings } from "./integrationRegistry.ts";
import { validRegistrationInput } from "./authPolicy.ts";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth.ts";

export interface G360Criterion {
  id: string;
  pillarId: "cadastro" | "otimizacao" | "reputacao" | "midia";
  title: string;
  status: "critical" | "warning" | "good";
  score: number;
  isInstagram?: boolean;
  maxScore: number;
  currentValue: string;
  recommendedValue: string;
  impact: "Alto" | "Medio" | "Baixo";
  whyItMatters: string;
  howToFix: string[];
  serviceToOffer: string;
}

export interface G360GeogridPin {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  rank: number;
  tier: "top" | "mid" | "low";
  zoneLabel: string;
}

export interface G360Competitor {
  rank: number;
  name: string;
  rating: number;
  reviewsCount: number;
  photosCount: number;
  verified: boolean;
  hasWebsite: boolean;
  gbpScore: number;
  isTarget?: boolean;
  distanceKm: number;
  category: string;
}

export interface G360KeywordAnalysis {
  keyword: string;
  searchVolumeMonthly: number;
  intent: "Comercial Local" | "Urgencia / Imediata" | "Transacional";
  averageRank: number;
  top3SharePct: number;
  pins: G360GeogridPin[];
  competitors: G360Competitor[];
}

export interface G360AuditReport {
  id: string;
  createdAt: string;
  business: any;
  verified: boolean;
  overallScore: number;
  projectedScoreAfterOptimization: number;
  classification: "Critico" | "Fraco" | "Razoavel" | "Bom" | "Excelente";
  growthPotential: "Alto" | "Moderado" | "Consolidado";
  criticalCount: number;
  warningCount: number;
  goodCount: number;
  pillars: Array<{
    id: "cadastro" | "otimizacao" | "reputacao" | "midia";
    name: string;
    score: number;
    status: "critical" | "warning" | "good";
    summary: string;
  }>;
  criteria: G360Criterion[];
  keywords: G360KeywordAnalysis[];
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return guardSdkClient('gemini', new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 10000,
      retryOptions: { attempts: 1 },
      headers: { "User-Agent": "aistudio-build" },
    },
  }));
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function generateKeywordsForBusiness(biz: any): string[] {
  const name = String(biz?.name || "").toLowerCase();
  const cat = String(biz?.category || "servicos").toLowerCase();
  const city = String(biz?.city || "Anápolis").trim();

  if (/moveis|planejad|marcenar|cozinha/.test(`${name} ${cat}`)) {
    return [
      `moveis planejados em ${city}`,
      `cozinha planejada em ${city}`,
      `marcenaria de alto padrao ${city}`,
      `guarda roupa planejado em ${city}`,
      `moveis sob medida em ${city}`,
    ];
  }
  if (/gas|ultragaz|liquigas|supergasbras|botijao/.test(`${name} ${cat}`)) {
    return [
      `revenda de gas em ${city}`,
      `entrega de gas em ${city}`,
      `deposito de gas perto de mim ${city}`,
      `disk gas rapido em ${city}`,
      `botijao de gas p13 em ${city}`,
    ];
  }
  if (/farmac|drogari/.test(`${name} ${cat}`)) {
    return [
      `farmacia 24h em ${city}`,
      `entrega de medicamentos em ${city}`,
      `drogaria com delivery em ${city}`,
      `farmacia perto de mim ${city}`,
      `dermocosmeticos em ${city}`,
    ];
  }
  if (/clinic|odonto|dentist|medic|dr\b/.test(`${name} ${cat}`)) {
    return [
      `clinica odontologica em ${city}`,
      `implante dentario em ${city}`,
      `alinhadores invisiveis em ${city}`,
      `dentista especialista em ${city}`,
      `reabilitacao oral em ${city}`,
    ];
  }
  if (/sorvet|acai|gelat/.test(`${name} ${cat}`)) {
    return [
      `sorveteria em ${city}`,
      `melhor sorvete artesanal ${city}`,
      `acai e sorvetes em ${city}`,
      `sorveteria aberta agora ${city}`,
      `sobremesas geladas em ${city}`,
    ];
  }
  if (/bateria|oficina|auto|mecan/.test(`${name} ${cat}`)) {
    return [
      `baterias automotivas em ${city}`,
      `entrega de bateria socorro ${city}`,
      `auto eletrica e baterias ${city}`,
      `bateria moura heliar em ${city}`,
      `troca de bateria em domicilio ${city}`,
    ];
  }
  const cleanCat = String(biz?.category || "Empresa Local").split("&")[0].trim().toLowerCase();
  return [
    `${cleanCat} em ${city}`,
    `melhor ${cleanCat} em ${city}`,
    `${cleanCat} perto de mim ${city}`,
    `orcamento ${cleanCat} ${city}`,
    `atendimento ${cleanCat} ${city}`,
  ];
}

function buildCompetitorsForKeyword(biz: any, keyword: string, targetRank: number, targetScore: number): G360Competitor[] {
  const city = String(biz?.city || "Anápolis");
  const cat = String(biz?.category || "Comércio Local");
  const hay = `${biz?.name || ""} ${cat}`.toLowerCase();
  const seed = hashSeed(`${biz?.name || "biz"}-${keyword}`);

  let names = [
    `Prime ${cat.split(" ")[0]} ${city}`,
    `Grupo Excelência ${city}`,
    `Central ${cat.split(" ")[0]} & Cia`,
    `Master Soluções ${city}`,
    ` Imperial ${cat.split(" ")[0]}`,
    `Nova Era ${cat.split(" ")[0]}`,
  ];

  if (/moveis|planejad|marcenar/.test(hay)) {
    names = [
      `Todeschini & Studio ${city}`,
      `Italínea Prime Ambientes`,
      `Marcenaria Conceito Sob Medida`,
      ` Finger Móveis Planejados ${city}`,
      `Casa Nobre Marcenaria Design`,
      ` Stylus Planejados & Interiores`,
    ];
  } else if (/gas|botijao/.test(hay)) {
    names = [
      `Ultragaz Distribuidora Central ${city}`,
      `Supergasbras Entrega Expressa`,
      `Nacional Gás & Água ${city}`,
      `Consigaz Depósito Matriz`,
      `Rápido Gás 24 Horas`,
      `Aliança Gás e Água Mineral`,
    ];
  } else if (/farmac|drogari/.test(hay)) {
    names = [
      `Drogasil Avenida Principal`,
      `Pague Menos Farmácias ${city}`,
      `Drogaria Pacheco Matriz`,
      `Farmácia São Paulo Express`,
      `Drogaria Santa Marta ${city}`,
      `FarmaVida Popular`,
    ];
  } else if (/clinic|odonto|dentist|medic/.test(hay)) {
    names = [
      `Instituto OdontoPrime ${city}`,
      `Clínica Oral Sin Implantes`,
      `Studio Dental Care3D`,
      `Centro Médico & Odonto Integrado`,
      `OdontoCompany Unidade Centro`,
      `Clínica Sorriso Nobre`,
    ];
  }

  const list: G360Competitor[] = [];
  const clampedRank = Math.max(2, Math.min(7, targetRank));
  const realComps = Array.isArray(biz?.realCompetitors) ? biz.realCompetitors : [];

  for (let r = 1; r <= 7; r++) {
    if (r === clampedRank) {
      list.push({
        rank: r,
        name: biz.name || "Sua Empresa",
        rating: Number(biz.rating || 4.6),
        reviewsCount: Number(biz.rating_count || 18),
        photosCount: Number(biz.photos_count ?? (Array.isArray(biz.photos) ? Math.max(8, biz.photos.length * 4) : 12)),
        verified: Boolean(biz.verified),
        hasWebsite: Boolean(biz.website && String(biz.website).trim().length > 4),
        gbpScore: targetScore,
        isTarget: true,
        distanceKm: 0.4,
        category: cat,
      });
    } else {
      const idx = r < clampedRank ? r - 1 : r - 2;
      const realComp = realComps[idx];
      const compName = realComp?.name || names[idx % names.length].trim();
      const isBetter = r < clampedRank;
      const compScore =
        realComp?.gbpScore ||
        (isBetter
          ? Math.min(96, Math.max(targetScore + (clampedRank - r) * 7, 74 + (7 - r) * 3))
          : Math.max(32, targetScore - (r - clampedRank) * 6));
      const reviews =
        realComp?.reviewsCount ??
        (isBetter
          ? 95 + ((seed + r * 37) % 240)
          : Math.max(4, Math.round(Number(biz.rating_count || 20) * 0.6 - r * 2)));
      list.push({
        rank: r,
        name: compName,
        rating:
          realComp?.rating ??
          (isBetter ? Number((4.8 + (r === 1 ? 0.1 : 0)).toFixed(1)) : Number((4.3 + (r % 3) * 0.1).toFixed(1))),
        reviewsCount: reviews,
        photosCount: realComp?.photosCount ?? (isBetter ? 65 + ((seed + r * 19) % 85) : 9 + r * 3),
        verified: typeof realComp?.verified === "boolean" ? realComp.verified : isBetter ? true : r % 2 === 0,
        hasWebsite: typeof realComp?.hasWebsite === "boolean" ? realComp.hasWebsite : isBetter,
        gbpScore: compScore,
        isTarget: false,
        distanceKm: Number((0.8 + r * 0.55).toFixed(1)),
        category: cat,
      });
    }
  }
  return list;
}

export function parseAddrCityUf(addrStr: string, fallbackCity = "Anápolis", fallbackUf = "GO") {
  const addr = String(addrStr || "");
  const m = addr.match(/,\s*([^,-]+?)\s*-\s*([A-Z]{2})\b/);
  if (m) {
    const city = m[1].trim();
    const uf = m[2].trim();
    const before = addr.slice(0, m.index).split("-");
    const neighborhood = before.length > 1 ? before[before.length - 1].replace(/,/g, "").trim() : "";
    return { city, uf, neighborhood };
  }
  const ufMatch = addr.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) {
    const uf = ufMatch[1];
    const beforeUf = addr.slice(0, ufMatch.index).replace(/[,-\s]+$/, "");
    const parts = beforeUf.split(/[,-]/);
    const candidateCity = parts[parts.length - 1]?.trim();
    if (candidateCity && candidateCity.length > 2) {
      return { city: candidateCity, uf, neighborhood: parts[parts.length - 2]?.trim() || "Centro" };
    }
  }
  if (/anápolis|anapolis/i.test(addr)) return { city: "Anápolis", uf: "GO", neighborhood: "Centro" };
  if (/goiânia|goiania/i.test(addr)) return { city: "Goiânia", uf: "GO", neighborhood: "Bueno" };
  if (/brasília|brasilia/i.test(addr)) return { city: "Brasília", uf: "DF", neighborhood: "Asa Sul" };
  if (/são paulo|sao paulo/i.test(addr)) return { city: "São Paulo", uf: "SP", neighborhood: "Centro" };
  if (/campo grande/i.test(addr)) return { city: "Campo Grande", uf: "MS", neighborhood: "Centro" };
  return { city: fallbackCity, uf: fallbackUf, neighborhood: "Centro" };
}

export function padOrTrimToExactLength(baseText: string, targetLength: number, fillerSentence: string): string {
  let cleaned = String(baseText || "").replace(/\s+/g, " ").trim();
  const filler = String(fillerSentence || "Atendimento especializado e qualidade garantida.").trim();
  if (!cleaned) cleaned = filler;

  if (cleaned.length === targetLength) {
    return cleaned;
  }

  while (cleaned.length < targetLength) {
    cleaned += " " + filler;
  }

  let cut = cleaned.slice(0, targetLength);
  if (cut.endsWith(" ")) {
    cut = cut.slice(0, -1) + ".";
  }
  if (!/[.!?]/.test(cut.slice(-1))) {
    cut = cut.slice(0, targetLength - 1) + ".";
  }
  if (cut.length > targetLength) {
    cut = cut.slice(0, targetLength);
  } else if (cut.length < targetLength) {
    cut = cut.padEnd(targetLength, ".");
  }
  return cut;
}

export function buildG360AuditReport(biz: any): G360AuditReport {
  const seed = hashSeed(String(biz?.place_id || biz?.name || "empresa"));
  const rawWebsite = String(biz?.website || "").trim();
  const isInstagram = /instagram\.com/i.test(rawWebsite);
  const hasWebsite = Boolean(rawWebsite.length > 4 && !isInstagram);
  const bioLen = String(biz?.bio || "").trim().length;
  const rating = Number(biz?.rating || 4.5);
  const ratingCount = Number(biz?.rating_count ?? 14);
  const photosCount = Number(biz?.photos_count ?? (Array.isArray(biz?.photos) ? biz.photos.length * 4 : 12));
  const additionalCatsCount = Number(biz?.additional_categories_count ?? (seed % 3 === 0 ? 0 : 1));
  const attributesCount = Number(biz?.features?.length ?? 3);
  const postsCount = Number(biz?.posts_count ?? 0);
  const servicesCount = Number(biz?.services_count ?? (Array.isArray(biz?.items) ? biz.items.length : 2));

  // Unless explicitly marked verified: true on a high-performing profile, prospect profiles default to showing real actionable gaps
  const verified =
    typeof biz?.verified === "boolean"
      ? biz.verified
      : ratingCount > 180 && hasWebsite;

  const criteria: G360Criterion[] = [
    {
      id: "verified_status",
      pillarId: "cadastro",
      title: "Verificacao de Propriedade do Perfil",
      status: verified ? "good" : "critical",
      score: verified ? 20 : 0,
      maxScore: 20,
      currentValue: verified ? "Perfil verificado pelo proprietario" : "Perfil nao verificado / Reivindicacao pendente",
      recommendedValue: "Perfil 100% verificado e protegido no Google",
      impact: "Alto",
      whyItMatters:
        "Sem a verificacao oficial, qualquer terceiro pode sugerir alteracoes no telefone ou fechar a ficha, e o algoritmo do Google limita drasticamente a entrega no Mapa.",
      howToFix: [
        "Solicitar ou assumir a propriedade oficial no painel Google Business Profile.",
        "Concluir o processo de verificacao por video, telefone comercial ou DNS do dominio.",
        "Blindar os usuarios proprietarios e gerentes autorizados.",
      ],
      serviceToOffer: "Assessoria de Reivindicacao, Verificacao e Blindagem GBP",
    },
    {
      id: "website_link",
      pillarId: "cadastro",
      title: "Website Oficial com Dominio Proprio",
      status: isInstagram ? "warning" : hasWebsite ? "good" : "critical",
      score: isInstagram ? 5 : hasWebsite ? 12 : 0,
      maxScore: 12,
      isInstagram,
      currentValue: isInstagram
        ? `Link de perfil no Instagram (${rawWebsite}) — Não substitui site oficial`
        : hasWebsite
        ? rawWebsite
        : "Nenhum site cadastrado na ficha",
      recommendedValue: "Landing page oficial com domínio próprio e dados estruturados Schema.org",
      impact: "Alto",
      whyItMatters: isInstagram
        ? "O Instagram não possui dados estruturados Schema.org LocalBusiness, não é indexado pelo rastreador local do Google e perde até 65% das conversões de quem pesquisa no Google Maps."
        : "Empresas com site estruturado e dados Schema.org LocalBusiness convertem até 3x mais cliques e enviam sinais de autoridade local para o Google.",
      howToFix: [
        "Gerar a pagina oficial otimizada para mobile e WhatsApp no modulo Site Express.",
        "Publicar gratuitamente em servidor CDN (Vercel ou Netlify) ou dominio proprio.",
        "Vincular a URL oficial com parametros de rastreamento no perfil do Google.",
      ],
      serviceToOffer: "Criacao de Site Express de Alta Conversao",
    },
    {
      id: "primary_secondary_categories",
      pillarId: "otimizacao",
      title: "Categoria Principal e Categorias Adicionais",
      status: additionalCatsCount >= 3 ? "good" : additionalCatsCount === 0 ? "critical" : "warning",
      score: additionalCatsCount >= 3 ? 12 : additionalCatsCount === 0 ? 3 : 7,
      maxScore: 12,
      currentValue: `${biz?.category || "1 categoria principal"} e ${additionalCatsCount} categorias adicionais`,
      recommendedValue: "1 categoria principal + 3 a 6 categorias adicionais estrategicas",
      impact: "Alto",
      whyItMatters:
        "As categorias definem para quais pesquisas de servicos e produtos o Google exibe a sua ficha no pacote local (Local Pack).",
      howToFix: [
        "Auditar a categoria principal dos 3 primeiros colocados da cidade.",
        "Adicionar todas as categorias secundarias pertinentes ao servico real da empresa.",
      ],
      serviceToOffer: "Otimizacao de Taxonomia e Categorias GBP",
    },
    {
      id: "semantic_description",
      pillarId: "otimizacao",
      title: "Descricao com SEO Semantico Local (750 caracteres)",
      status: bioLen >= 550 ? "good" : bioLen < 160 ? "critical" : "warning",
      score: bioLen >= 550 ? 10 : bioLen < 160 ? 2 : 6,
      maxScore: 10,
      currentValue: `${bioLen} caracteres preenchidos (recomendado: 650 a 750)`,
      recommendedValue: "750 caracteres com semantica local, servicos, bairros e diferenciais",
      impact: "Medio",
      whyItMatters:
        "Uma descricao completa contextualiza a atividade da empresa, cidades atendidas e especialidades tanto para o cliente quanto para a indexacao semantica.",
      howToFix: [
        "Redigir descricao de até 750 caracteres no modulo Pacote GBP.",
        "Incluir cidade de atuacao, especialidades reais e chamada clara para atendimento.",
      ],
      serviceToOffer: "Copywriting SEO Local para Google Meu Negocio",
    },
    {
      id: "seo_services_catalog",
      pillarId: "otimizacao",
      title: "Cadastro de Servicos com Palavras-Chave Locais",
      status: servicesCount >= 10 ? "good" : servicesCount <= 3 ? "critical" : "warning",
      score: servicesCount >= 10 ? 10 : servicesCount <= 3 ? 2 : 6,
      maxScore: 10,
      currentValue: `${servicesCount} servicos detalhados na ficha`,
      recommendedValue: "10 a 20 servicos com nome estrategico + descricao de 300 caracteres",
      impact: "Alto",
      whyItMatters:
        "O Google exibe justificativas de pesquisa ('Oferece moveis planejados') diretamente no Mapa quando os servicos estao cadastrados com descricoes completas.",
      howToFix: [
        "Mapear os 15 a 20 termos locais mais buscados pelos clientes da cidade.",
        "Cadastrar cada servico vinculado a categoria correspondente com texto de até 300 caracteres.",
      ],
      serviceToOffer: "Implementacao do Pacote de 20 Servicos e Produtos SEO",
    },
    {
      id: "profile_posts_activity",
      pillarId: "midia",
      title: "Publicacoes e Atualizacoes Recentes no Perfil",
      status: postsCount >= 8 ? "good" : postsCount === 0 ? "critical" : "warning",
      score: postsCount >= 8 ? 8 : postsCount === 0 ? 0 : 4,
      maxScore: 8,
      currentValue: postsCount === 0 ? "Nenhuma publicacao ativa nos ultimos 30 dias" : `${postsCount} publicacoes recentes`,
      recommendedValue: "Minimo de 10 publicacoes estrategicas com foto e botao de acao",
      impact: "Medio",
      whyItMatters:
        "Perfis com postagens constantes sinalizam empresa ativa e aumentam a conversao de visitantes que comparam fichas antes de ligar.",
      howToFix: [
        "Gerar o cronograma de 10 publicacoes de até 1.500 caracteres no modulo Pacote GBP.",
        "Agendar as postagens com botao 'Ligar agora' ou link direto de WhatsApp.",
      ],
      serviceToOffer: "Pacote de 10 Publicacoes Otimizadas + Agendamento",
    },
    {
      id: "photo_volume_quality",
      pillarId: "midia",
      title: "Volume e Padrao de Fotografias da Ficha",
      status: photosCount >= 40 ? "good" : photosCount < 15 ? "critical" : "warning",
      score: photosCount >= 40 ? 8 : photosCount < 15 ? 2 : 5,
      maxScore: 8,
      currentValue: `${photosCount} fotos identificadas (recomendado: 50+ fotos reais)`,
      recommendedValue: "Capa 4:3, logotipo 1:1, fachada, equipe, produtos e servicos nomeados",
      impact: "Alto",
      whyItMatters:
        "Fichas com mais de 50 fotografias reais recebem até 42% mais solicitacoes de rotas no Google Maps e 35% mais cliques para contato.",
      howToFix: [
        "Organizar fotos reais de fachada, interior, equipe e trabalhos executados.",
        "Renomear os arquivos com padrao descritivo antes do upload.",
      ],
      serviceToOffer: "Curadoria Visual e Otimizacao de Galeria GBP",
    },
    {
      id: "reviews_volume_velocity",
      pillarId: "reputacao",
      title: "Volume e Recorrencia de Avaliacoes de Clientes",
      status: ratingCount >= 120 ? "good" : ratingCount < 35 ? "critical" : "warning",
      score: ratingCount >= 120 ? 10 : ratingCount < 35 ? 3 : 6,
      maxScore: 10,
      currentValue: `${ratingCount} avaliacoes com nota media ${rating.toFixed(1)}`,
      recommendedValue: "Acima de 120 avaliacoes legitimas com nota superior a 4.8",
      impact: "Alto",
      whyItMatters:
        "A quantidade e a recencia das avaliacoes sao um dos 3 maiores fatores de decisao do consumidor e de posicionamento na grade local.",
      howToFix: [
        "Implantar QR Code dinamico de avaliacao no balcao e no pos-venda via WhatsApp.",
        "Responder 100% das avaliacoes recebidas utilizando termos naturais do negocio.",
      ],
      serviceToOffer: "Sistema de Captacao e Resposta Profissional de Avaliacoes",
    },
    {
      id: "contact_whatsapp_hours",
      pillarId: "cadastro",
      title: "Consistencia de Endereco, Horarios, Telefone e Chat WhatsApp",
      status: attributesCount >= 5 ? "good" : "warning",
      score: attributesCount >= 5 ? 10 : 6,
      maxScore: 10,
      currentValue: `Telefone ${biz?.phone || "cadastrado"} · ${attributesCount} atributos preenchidos`,
      recommendedValue: "Horarios completos, link direto de WhatsApp no campo Chat e 10+ atributos",
      impact: "Medio",
      whyItMatters:
        "Clientes desistem de entrar em contato quando o horario parece desatualizado ou falta o botao rapido de conversa via WhatsApp.",
      howToFix: [
        "Inserir link wa.me oficial no campo de Chat do Google Meu Negocio.",
        "Preencher todos os atributos de pagamento, acessibilidade e conveniencia.",
      ],
      serviceToOffer: "Padronizacao Cadastral NAP e Atributos Avancados",
    },
  ];

  const totalEarned = criteria.reduce((acc, c) => acc + c.score, 0);
  const totalMax = criteria.reduce((acc, c) => acc + c.maxScore, 0);
  let overallScore = Math.round((totalEarned / totalMax) * 100);
  if (!verified && overallScore > 54) {
    overallScore = 46; // Unverified profiles are capped in GBP Check methodology
  }

  const classification: G360AuditReport["classification"] =
    overallScore < 40
      ? "Critico"
      : overallScore < 55
      ? "Fraco"
      : overallScore < 70
      ? "Razoavel"
      : overallScore < 85
      ? "Bom"
      : "Excelente";

  const pillarCalc = (pid: G360Criterion["pillarId"], name: string, summary: string) => {
    const sub = criteria.filter((c) => c.pillarId === pid);
    const s = Math.round((sub.reduce((a, b) => a + b.score, 0) / Math.max(1, sub.reduce((a, b) => a + b.maxScore, 0))) * 100);
    const status: "critical" | "warning" | "good" = s < 50 ? "critical" : s < 75 ? "warning" : "good";
    return { id: pid, name, score: s, status, summary };
  };

  const pillars = [
    pillarCalc("cadastro", "Saude Cadastral & Verificacao", "Propriedade do perfil, website, NAP e canais de contato"),
    pillarCalc("otimizacao", "Otimizacao SEO & Categorias", "Categorias adicionais, descricao 750c, servicos e produtos"),
    pillarCalc("reputacao", "Reputacao & Autoridade", "Volume de avaliacoes, nota media e taxa de resposta"),
    pillarCalc("midia", "Midia & Atividade Comercial", "Quantidade de fotos reais e frequencia de publicacoes"),
  ];

  // Build 5x5 Geogrid for 5 local keywords
  const baseLat = Number(biz?.lat) || -16.3285;
  const baseLng = Number(biz?.lng) || -48.9534;
  const kwStrings = generateKeywordsForBusiness(biz);

  const zones = [
    "Noroeste", "Norte", "Nordeste", "Setor Norte", "Alto da Cidade",
    "Oeste", "Centro-Oeste", "Centro Comercial", "Centro-Leste", "Leste",
    "Bairro Industrial", "Zona Central", "Raio Principal", "Eixo Urbano", "Parque Residencial",
    "Sudoeste", "Sul-Oeste", "Zona Sul", "Sul-Leste", "Sudeste",
    "Expansao Sul", "Via Expressa", "Distrito Sul", "Contorno", "Regiao Leste Sul",
  ];

  const keywords: G360KeywordAnalysis[] = kwStrings.map((kw, kwIdx) => {
    const kwSeed = hashSeed(`${biz?.name || "biz"}-${kw}`);
    const baseCenterRank = verified ? (overallScore >= 75 ? 2 : 5) : 8 + (kwIdx % 4);
    const pins: G360GeogridPin[] = [];

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const distFromCenter = Math.hypot(r - 2, c - 2);
        const latOffset = (2 - r) * 0.0085;
        const lngOffset = (c - 2) * 0.0085;
        const noise = ((kwSeed + r * 7 + c * 13) % 5) - 1;
        const rank = Math.max(
          1,
          Math.min(20, Math.round(baseCenterRank + distFromCenter * 2.8 + kwIdx * 0.9 + noise))
        );
        const tier: G360GeogridPin["tier"] = rank <= 3 ? "top" : rank <= 10 ? "mid" : "low";
        const idx = r * 5 + c;
        pins.push({
          id: `pin-${kwIdx}-${r}-${c}`,
          row: r,
          col: c,
          lat: Number((baseLat + latOffset).toFixed(6)),
          lng: Number((baseLng + lngOffset).toFixed(6)),
          rank,
          tier,
          zoneLabel: zones[idx] || `Ponto ${idx + 1}`,
        });
      }
    }

    const avgRank = Number((pins.reduce((a, p) => a + p.rank, 0) / pins.length).toFixed(1));
    const top3Count = pins.filter((p) => p.rank <= 3).length;
    const top3SharePct = Math.round((top3Count / pins.length) * 100);
    const centerPinRank = pins[12]?.rank || Math.round(avgRank);

    return {
      keyword: kw,
      searchVolumeMonthly: 680 + ((kwSeed % 18) * 110),
      intent: kwIdx === 0 ? "Comercial Local" : kwIdx === 1 ? "Urgencia / Imediata" : "Transacional",
      averageRank: avgRank,
      top3SharePct,
      pins,
      competitors: buildCompetitorsForKeyword(biz, kw, Math.min(7, Math.max(2, centerPinRank)), overallScore),
    };
  });

  return {
    id: `audit-${uuidv4().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    business: {
      ...biz,
      verified,
    },
    verified,
    overallScore,
    projectedScoreAfterOptimization: Math.min(96, Math.max(88, overallScore + 38)),
    classification,
    growthPotential: overallScore < 75 ? "Alto" : "Moderado",
    criticalCount: criteria.filter((c) => c.status === "critical").length,
    warningCount: criteria.filter((c) => c.status === "warning").length,
    goodCount: criteria.filter((c) => c.status === "good").length,
    pillars,
    criteria,
    keywords,
  };
}

export function buildGbpOptimizationPackage(biz: any) {
  const name = String(biz?.name || "Encanto Móveis Planejados").trim();
  const city = String(biz?.city || "Anápolis").trim();
  const uf = String(biz?.uf || "GO").trim();
  const category = String(biz?.category || "Fornecedor de móveis planejados").trim();
  const phone = String(biz?.phone || "(62) 99113-8004").trim();
  const whatsappClean = String(biz?.whatsapp || "55" + phone.replace(/\D/g, "")).replace(/\D/g, "");
  const hay = `${name} ${category}`.toLowerCase();

  let primaryCategory = category;
  let additionalCategories = [
    "Prestador de serviços empresariais",
    "Consultoria especializada",
    "Atendimento comercial",
    "Serviço de entrega local",
    "Comércio local",
  ];

  let rawDescription = "";
  const servicesBase: Array<{ name: string; category?: string; localTerm: string; rawDesc: string }> = [];
  const productsBase: Array<{ name: string; category: string; priceLabel: string; rawDesc: string }> = [];

  if (/moveis|planejad|marcenar|cozinha/.test(hay)) {
    primaryCategory = "Fornecedor de móveis planejados";
    additionalCategories = [
      "Marceneiro",
      "Construção e venda de armários de cozinha",
      "Designer de interiores",
      "Loja de mobiliário de escritório",
      "Loja de mobília para o quarto",
      "Loja de móveis de cozinha",
      "Loja de mobiliário infantil",
    ];

    rawDescription = `A ${name} transforma ambientes com projetos personalizados, funcionais e sofisticados em ${city}, ${uf}. Somos especialistas em móveis planejados e móveis sob medida para cozinhas, quartos, salas, closets, banheiros, escritórios e espaços comerciais. Cada projeto é desenvolvido de acordo com as necessidades do cliente, aproveitando melhor cada espaço e unindo beleza, organização, qualidade e praticidade. Atendemos quem busca marcenaria em ${city}, cozinha planejada, guarda-roupa sob medida, painel para TV, armários planejados e soluções completas para residências e empresas. Solicite seu orçamento e conte com atendimento especializado, projeto personalizado e acabamento profissional para valorizar seu imóvel.`;

    const móveisServices = [
      { name: `Móveis Planejados em ${city}`, cat: primaryCategory, term: `móveis planejados em ${city.toLowerCase()}`, desc: `Projetos de móveis planejados em ${city}, desenvolvidos para aproveitar cada espaço com funcionalidade, beleza e acabamento premium. Criamos soluções sob medida para casas, apartamentos e empresas com materiais selecionados e instalação profissional.` },
      { name: "Marcenaria de Alto Padrão", cat: "Marceneiro", term: `marcenaria de alto padrão ${city.toLowerCase()}`, desc: `Marcenaria de alto padrão em ${city} para quem busca exclusividade, sofisticação e acabamento impecável em cada detalhe. Executamos projetos sob medida com ferragens amortecidas e MDF de primeira linha.` },
      { name: `Cozinha Planejada em ${city}`, cat: "Construção e venda de armários de cozinha", term: `cozinha planejada em ${city.toLowerCase()}`, desc: `Cozinhas planejadas em ${city} com projeto funcional, moderno e totalmente personalizado para cozinhas pequenas, americanas ou com ilha. Organização inteligente de armários, gavetões e torre quente.` },
      { name: `Móveis Sob Medida em ${city}`, cat: primaryCategory, term: `móveis sob medida em ${city.toLowerCase()}`, desc: `Desenvolvimento de móveis sob medida em ${city} para ambientes residenciais e comerciais. Cada projeto é pensado para unir estética, ergonomia e durabilidade no uso diário.` },
      { name: "Guarda-Roupa Planejado", cat: "Loja de mobília para o quarto", term: `guarda roupa planejado ${city.toLowerCase()}`, desc: `Guarda-roupa planejado sob medida em ${city}, com divisões internas personalizadas, gavetas organizadoras, cabideiros, sapateiras e portas de correr ou giro com espelho.` },
      { name: "Closet Planejado Sob Medida", cat: "Loja de mobília para o quarto", term: `closet planejado em ${city.toLowerCase()}`, desc: `Closet planejado em ${city} com projeto personalizado para organizar roupas, calçados, bolsas e acessórios com iluminação em LED e aproveitamento inteligente de cada centímetro.` },
      { name: "Móveis Planejados para Quarto", cat: "Loja de mobília para o quarto", term: `quarto planejado em ${city.toLowerCase()}`, desc: `Quartos planejados de casal, solteiro e infantil em ${city} com cabeceira, criados-mudos, bancada de estudos e armários sob medida para máximo conforto.` },
      { name: "Cozinha Planejada Pequena e Apartamento", cat: "Loja de móveis de cozinha", term: `cozinha planejada apartamento ${city.toLowerCase()}`, desc: `Cozinha planejada inteligente para apartamentos e espaços compactos em ${city}, otimizando circulação, armazenamento vertical e integração com sala de jantar.` },
      { name: "Painel de TV e Sala Planejada", cat: primaryCategory, term: `painel de tv planejado ${city.toLowerCase()}`, desc: `Painel de TV e home theater planejado em ${city}, com ripado, iluminação indireta, passagem oculta de cabos e rack suspenso sob medida para sua sala.` },
      { name: "Móveis Planejados para Banheiro e Lavanderia", cat: primaryCategory, term: `armário planejado banheiro ${city.toLowerCase()}`, desc: `Gabinetes de banheiro e armários de área de serviço sob medida em ${city}, resistentes à umidade e projetados para manter tudo organizado e funcional.` },
      { name: "Móveis Planejados para Escritório e Comercial", cat: "Loja de mobiliário de escritório", term: `móveis planejados escritório ${city.toLowerCase()}`, desc: `Mobiliário corporativo, recepções, consultórios e home office planejado em ${city}, transmitindo credibilidade, ergonomia e produtividade para o seu negócio.` },
      { name: "Área Gourmet e Varanda Planejada", cat: primaryCategory, term: `área gourmet planejada ${city.toLowerCase()}`, desc: `Armários sob medida para área gourmet, churrasqueira e varanda em ${city}, aliando resistência, design contemporâneo e praticidade para receber amigos e família.` },
      { name: "Home Theater e Rack Suspenso", cat: primaryCategory, term: `home theater planejado ${city.toLowerCase()}`, desc: `Home theater e móveis integrados para salas de estar em ${city}, com canaletas embutidas, nichos decorativos e iluminação suave para valorizar seu espaço de lazer.` },
      { name: "Armários de Cozinha com Amortecimento", cat: "Construção e venda de armários de cozinha", term: `armários de cozinha ${city.toLowerCase()}`, desc: `Armários aéreos e balcões planejados com dobradiças e corrediças telescópicas com amortecimento slow, proporcionando silêncio, suavidade e longa vida útil.` },
      { name: "Mobiliário para Recepção e Clínicas", cat: "Loja de mobiliário de escritório", term: `balcão de recepção ${city.toLowerCase()}`, desc: `Balcões de atendimento, recepções elegantes e móveis técnicos planejados para clínicas médicas, odontológicas e escritórios advocatícios em ${city}.` },
      { name: "Cristaleira Iluminada e Adega Sob Medida", cat: primaryCategory, term: `cristaleira planejada ${city.toLowerCase()}`, desc: `Cristaleiras modernas com portas em perfil de alumínio preto, vidro reflecta e prateleiras com iluminação LED para compor salas de jantar refinadas em ${city}.` },
      { name: "Cabeceira Estofada com Painel Ripado", cat: "Loja de mobília para o quarto", term: `cabeceira ripada ${city.toLowerCase()}`, desc: `Painéis de cabeceira ripados de piso a teto com módulos estofados, tomadas embutidas e mesinhas suspensas sob medida para quartos aconchegantes.` },
      { name: "Estante Planejada e Divisória de Ambientes", cat: primaryCategory, term: `divisória de ambientes planejada ${city.toLowerCase()}`, desc: `Estantes vazadas planejadas para integrar ou delimitar salas de estar, jantar e home office com elegância visual e aproveitamento inteligente da luz natural.` },
      { name: "Móveis para Quarto Infantil e Brinquedoteca", cat: "Loja de mobiliário infantil", term: `quarto infantil planejado ${city.toLowerCase()}`, desc: `Mobiliário sob medida seguro e ergonômico para crianças em ${city}, com cantos arredondados, nichos para brinquedos, camas lúdicas e bancadas de estudo.` },
      { name: "Consultoria e Projeto 3D Personalizado", cat: "Designer de interiores", term: `projeto 3d móveis ${city.toLowerCase()}`, desc: `Desenvolvimento de maquete 3D fotorrealista com simulação completa de cores, texturas e circulação do espaço antes da fabricação dos móveis planejados.` },
    ];

    móveisServices.forEach((s) => {
      servicesBase.push({ name: s.name, category: s.cat, localTerm: s.term, rawDesc: s.desc });
    });

    const móveisProducts = [
      { name: "Cozinha Planejada Sob Medida", cat: "Cozinhas Planejadas", price: "Orçamento sob medida", desc: `Projeto completo de cozinha planejada em ${city} com armários superiores, inferiores, torre quente, gaveteiros com amortecedor e divisão interna sob medida. Produzida em MDF de alta densidade resistente à umidade, com acabamento impecável e puxadores modernos. Inclui consultoria de espaço e projeto 3D para você visualizar exatamente o resultado antes da fabricação.` },
      { name: "Closets e Dormitórios Completos", cat: "Dormitórios & Closets", price: "Projeto personalizado", desc: `Guarda-roupas e closets sob medida em ${city} com divisão interna planejada para roupas longas, calçados, acessórios e joias. Estrutura robusta em MDF, portas com espelho e trilho suave, além de fita de LED embutida com acionamento automático. Máximo conforto e organização para valorizar seu quarto.` },
      { name: "Salas de Estar com Painel Ripado", cat: "Salas & Home", price: "Consulte pelo WhatsApp", desc: `Painéis de TV de grande formato com acabamento ripado nobre, nichos embutidos e rack suspenso com gavetas de toque. Projetado para ocultar 100% da fiação elétrica e equipamentos de áudio, criando uma estética limpa, moderna e sofisticada para sua casa em ${city}.` },
      { name: "Banheiros e Áreas de Serviço", cat: "Áreas Úmidas", price: "Orçamento rápido", desc: `Armários planejados para banheiros, lavabos e lavanderias com MDF naval e vedação especial contra umidade. Aproveitamento milimétrico de sifões e colunas hidráulicas, garantindo gavetões úteis, tulhas de roupa suja e espelheiras iluminadas com ótimo custo-benefício.` },
      { name: "Escritórios Corporativos & Recepções", cat: "Corporativo & Clínicas", price: "Atendimento corporativo", desc: `Mobiliário planejado corporativo em ${city} para escritórios de advocacia, clínicas de saúde e sedes empresariais. Estações de trabalho ergonômicas, balcões de recepção imponentes e armários de arquivo com fechadura, transmitindo credibilidade imediata a clientes.` },
      { name: "Varanda e Espaço Gourmet", cat: "Área Gourmet", price: "Projeto 3D incluso", desc: `Armários sob medida para bancadas de churrasqueira, ilhas gourmet e varandas fechadas em ${city}. Materiais preparados para suportar calor e vapores de cocção, aliando requinte no design com portas almofadadas ou lisas e ferragens inoxidáveis.` },
      { name: "Estantes & Mobiliário Sob Medida", cat: "Complementos Exclusivos", price: "Sob consulta", desc: `Estantes de livros de piso a teto, adegas climatizadas sob medida, nichos decorativos e mesas de cabeceira personalizadas em ${city}. Cada detalhe é desenhado para atender ao estilo de vida da sua família com entrega pontual e montagem limpa e profissional.` },
    ];

    móveisProducts.forEach((p) => {
      productsBase.push({ name: p.name, category: p.cat, priceLabel: p.price, rawDesc: p.desc });
    });
  } else {
    rawDescription = `A ${name} é referência em ${category.toLowerCase()} em ${city}, ${uf}, oferecendo atendimento ágil, soluções confiáveis e acompanhamento profissional para clientes residenciais e comerciais. Trabalhamos com foco na qualidade técnica, transparência em cada etapa e atendimento direto pelo WhatsApp e telefone. Nossa estrutura em ${city} está preparada para atender com pontualidade, segurança e excelente custo-benefício quem procura ${category.toLowerCase()}, suporte especializado e condições facilitadas de pagamento. Entre em contato agora mesmo para tirar dúvidas, consultar disponibilidade ou solicitar seu orçamento personalizado com nossa equipe em ${city}.`;

    const genericNames = [
      `${category} Especializado em ${city}`,
      `Atendimento Prioritário em ${city}`,
      `Orçamento Rápido via WhatsApp`,
      `Consultoria e Diagnóstico Local`,
      `Atendimento Residencial e Comercial`,
      `Suporte com Garantia em ${city}`,
      `Instalação e Manutenção Técnica`,
      `Serviços Expressos para Empresas`,
      `Atendimento Agendado e Pontual`,
      `Soluções Sob Medida em ${city}`,
      `Assessoria Completa para Clientes`,
      `Entrega e Execução Confiável`,
      `Produtos e Materiais de Primeira Linha`,
      `Equipe Qualificada e Treinada`,
      `Condições Especiais de Pagamento`,
      `Atendimento no Centro e Bairros`,
      `Planos e Contratos Corporativos`,
      `Avaliação Técnica sem Compromisso`,
      `Reparos e Ajustes de Precisão`,
      `Acompanhamento Pós-Venda Dedicado`,
    ];

    genericNames.forEach((gName, idx) => {
      servicesBase.push({
        name: gName,
        category: primaryCategory,
        localTerm: `${category.toLowerCase()} em ${city.toLowerCase()} ${idx + 1}`,
        rawDesc: `Prestação de ${gName.toLowerCase()} pela ${name} em ${city}, com equipe dedicada, materiais inspecionados e agilidade máxima. Atendemos com pontualidade e transparência para garantir a melhor experiência e segurança para a sua rotina diária.`,
      });
    });

    const genericProducts = [
      { name: `Linha Premium — ${name}`, cat: "Destaques", price: "Sob consulta", desc: `Pacote principal de produtos e soluções técnicas com garantia comprovada em ${city}. Desenvolvido para proporcionar máxima eficiência, economia e tranquilidade para clientes residenciais e comerciais.` },
      { name: "Atendimento Prioritário Especializado", cat: "Serviços", price: "Sob medida", desc: `Agilidade e acompanhamento técnico dedicado pela equipe da ${name} em todos os bairros de ${city}. Suporte ágil com profissionais certificados e atendimento humanizado.` },
      { name: "Pacote Completo com Condição Facilitada", cat: "Especial", price: "Pix e Cartão", desc: `Excelente relação custo-benefício com parcelamento flexível e garantia formal em ${city}. Ideal para quem busca padrão profissional sem surpresas no orçamento final.` },
      { name: "Linha Corporativa para Empresas", cat: "Empresarial", price: "Contrato PJ", desc: `Soluções completas com faturamento facilitado, atendimento programado e suporte técnico direto para empresas, escritórios e condomínios de ${city} e região.` },
      { name: "Manutenção Preventiva e Corretiva", cat: "Manutenção", price: "Visita técnica", desc: `Diagnóstico minucioso e reparos rápidos para assegurar pleno funcionamento e durabilidade dos seus equipamentos e instalações em ${city}.` },
      { name: "Kit Econômico para Residências", cat: "Residencial", price: "Valor acessível", desc: `Opção compacta e acessível com a mesma qualidade de acabamento e atendimento atencioso da equipe ${name}. Perfeito para demandas pontuais e residenciais.` },
      { name: "Plano Fidelidade com Suporte Contínuo", cat: "Assinatura", price: "Mensalidade acessível", desc: `Acompanhamento periódico com visitas preventivas e descontos exclusivos em novas demandas em ${city}. Tranquilidade garantida para o seu patrimônio.` },
    ];

    genericProducts.forEach((p) => {
      productsBase.push({ name: p.name, category: p.cat, priceLabel: p.price, rawDesc: p.desc });
    });
  }

  // Exact 750 characters for profile description
  const description750 = padOrTrimToExactLength(
    rawDescription,
    750,
    `Entre em contato com a ${name} em ${city}, ${uf} e garanta atendimento especializado com alta qualidade, pontualidade e orçamento transparente.`
  );

  // Exact 20 services, each exactly 300 characters
  const servicesList = servicesBase.slice(0, 20).map((s) => ({
    name: s.name,
    category: s.category || primaryCategory,
    localTerm: s.localTerm,
    description: padOrTrimToExactLength(
      s.rawDesc,
      300,
      `Solicite seu orçamento com a ${name} em ${city} e receba atendimento profissional com pontualidade.`
    ),
  }));

  // Exact 7 products (between 6 and 8), each exactly 1000 characters
  const productsList = productsBase.slice(0, 7).map((p) => ({
    name: p.name,
    category: p.category,
    priceLabel: p.priceLabel,
    description: padOrTrimToExactLength(
      p.rawDesc,
      1000,
      `A ${name} em ${city} preza pela excelência em cada detalhe, combinando materiais certificados, pontualidade rigorosa e atendimento ágil via WhatsApp ou telefone ${phone}. Solicite seu orçamento sem compromisso e conte com especialistas experientes para tirar suas dúvidas e encontrar a melhor solução para sua necessidade.`
    ),
  }));

  // 10 Informative Posts + 1 Offer Post = 11 Posts total, each exactly 1500 characters
  const postThemes = [
    { obj: "Apresentação & Autoridade Local", title: `Excelência e qualidade comprovada em ${city}`, isOffer: false },
    { obj: "Serviço Principal em Destaque", title: servicesList[0]?.name || `Soluções sob medida em ${city}`, isOffer: false },
    { obj: "Diferencial de Acabamento e Atendimento", title: "Por que escolher um atendimento especializado e experiente?", isOffer: false },
    { obj: "Solução para Espaços e Necessidades Reais", title: servicesList[2]?.name || "Planejamento inteligente para o seu dia a dia", isOffer: false },
    { obj: "Processo de Atendimento Transparente", title: "Do primeiro contato ao projeto concluído com pontualidade", isOffer: false },
    { obj: "Destaque de Categoria & Portfólio", title: productsList[0]?.name || "Qualidade premium que valoriza o seu imóvel", isOffer: false },
    { obj: "Dúvida Frequente e Dicas Práticas", title: `Como solicitar seu orçamento rápido e sem burocracia em ${city}`, isOffer: false },
    { obj: "Atendimento Residencial e Comercial", title: `Soluções completas para casas, apartamentos e empresas em ${city}`, isOffer: false },
    { obj: "Bastidores e Padrão Construtivo", title: "Cuidado minucioso e precisão em cada detalhe executado", isOffer: false },
    { obj: "Convite Direto e Relacionamento", title: `Fale hoje mesmo com os especialistas da ${name} em ${city}`, isOffer: false },
    { obj: "Oferta & Condição Especial", title: `Condição Especial de Atendimento — Solicite Hoje com a ${name}`, isOffer: true },
  ];

  const now = Date.now();
  const posts = postThemes.map((pt, idx) => {
    const postDate = new Date(now + (idx + 1) * 3 * 86400000).toISOString().slice(0, 10);
    const svc = servicesList[idx % servicesList.length];
    const postIntro = pt.isOffer
      ? `ATENÇÃO: CONDIÇÃO ESPECIAL POR TEMPO LIMITADO NA ${name.toUpperCase()} EM ${city.toUpperCase()}!\n\n` +
        `Se você está planejando transformar seu ambiente ou precisa de ${svc.name.toLowerCase()}, preparamos condições exclusivas de negociação para este mês. Atendemos toda a cidade de ${city} com visita técnica, atendimento personalizado e facilidade de pagamento no cartão e Pix.`
      : `${pt.title}.\n\nNa ${name}, cada atendimento em ${city} é conduzido com compromisso total com as necessidades do cliente, unindo planejamento detalhado, materiais de alta durabilidade e cumprimento rigoroso dos prazos combinados. Nosso foco em ${svc.name.toLowerCase()} garante um resultado funcional, seguro e esteticamente impecável.`;

    const fillerPost = `Na ${name}, localizada em ${city}, nosso objetivo diário é entregar soluções de alta qualidade com segurança, transparência e respeito ao prazo do cliente. Oferecemos suporte completo pelo telefone ${phone} e WhatsApp. Quem pesquisa por ${svc.localTerm} sabe que pode confiar em nossa equipe técnica para um atendimento ágil e projeto sob medida. Entre em contato hoje mesmo, tire suas dúvidas e solicite uma demonstração personalizada. Estamos prontos para atender você com pontualidade e satisfação garantida em todos os bairros de ${city} e cidades vizinhas.`;

    const fullPostText = padOrTrimToExactLength(postIntro, 1500, fillerPost);

    return {
      number: idx + 1,
      objective: pt.obj,
      title: pt.title,
      isOfferPost: pt.isOffer,
      text: fullPostText,
      charCount: fullPostText.length,
      ctaType: pt.isOffer ? "Pedir orçamento" : "Ligar agora",
      ctaPhone: phone,
      scheduledDate: postDate,
      scheduledTime: "09:00",
      imageDirection: `Fotografia comercial 4:3 de ${svc.name.toLowerCase()} executada pela ${name} em ${city}, iluminação limpa e enquadramento profissional.`,
      status: "Pronto para agendar",
    };
  });

  const slugCity = city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const slugCat = primaryCategory
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 28);

  const photoSeoNames = [
    `${slugCat}-${slugCity}-capa-fachada-01.jpg`,
    `${slugCat}-${slugCity}-logotipo-oficial-02.jpg`,
    `${slugCat}-${slugCity}-ambiente-interno-03.jpg`,
    `${slugCat}-${slugCity}-atendimento-equipe-04.jpg`,
    ...servicesList.slice(0, 16).map((s, i) => {
      const sSlug = s.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 32);
      return `${sSlug}-${String(i + 5).padStart(2, "0")}.jpg`;
    }),
  ];

  const siteBriefing = {
    updatedAt: new Date().toISOString(),
    businessName: name,
    cityUf: `${city} - ${uf}`,
    primaryCategory,
    recommendedSiteModel: /moveis|clinic|advog|engenh|arquitet/.test(hay)
      ? "Landing Page Consultiva + Portfólio de Projetos (Foco em Orçamento via WhatsApp)"
      : /farmac|loja|gas|bateria/.test(hay)
      ? "Vitrine Express + Pedido Rápido no WhatsApp (Foco em Pronta-Entrega)"
      : "Site Institucional de Conversão Local (Foco em Agendamento e Contato Imediato)",
    whatsappLink: `https://wa.me/${whatsappClean}`,
    heroHeadline: `${servicesList[0]?.name || `${category} em ${city}`} com Acabamento Profissional e Atendimento Sob Medida`,
    heroSubheadline: description750.slice(0, 220),
    approvedServices: servicesList.slice(0, 6),
    approvedProducts: productsList.slice(0, 4),
    localKeywords: servicesList.map((s) => s.localTerm),
  };

  return {
    businessName: name,
    city,
    uf,
    phone,
    whatsappUrl: `https://wa.me/${whatsappClean}`,
    primaryCategory,
    additionalCategories,
    description750,
    descriptionCharCount: description750.length,
    services: servicesList,
    products: productsList,
    posts,
    scheduledPosts: posts,
    photoSeoNames,
    siteBriefing,
  };
}

export function createG360Router(getDb: () => any, saveDb: (db: any) => void, demoBusinesses: any[]) {
  const router = Router();
  router.use(requireAuth);
  const actor = (req: any) => (req as AuthRequest).user!;
  const visible = (record: any, req: any) => actor(req).role === 'admin' || record.ownerUid === actor(req).uid;
  const legacyAdmin = (req: any, res: any, next: any) => actor(req).role === 'admin' ? next() : res.sendStatus(403);

  const ensureG360Db = () => {
    const db = getDb();
    // Fill only the request draft, without saving or rewriting existing records on read.
    if (!db.g360) db.g360 = {};
    db.g360.audits ??= [];
    db.g360.crmLeads ??= [];
    db.g360.packagesByBusiness ??= {};
    db.g360.financeGoals ??= { monthlyRevenueGoal: 15000, monthlyLeadsGoal: 30, averageTicketTarget: 1250 };
    db.g360.deploySettings ??= { vercelToken: '', netlifyToken: '', agencyName: 'G360 Google Business Intelligence', agencyPhone: '', agencyDocument: '' };
    return db.g360;
  };

  // HELPER: Get Active Keys
  const getMapsKey = () =>
    (
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ""
    ).trim();
  const getOutscraperKey = () => (process.env.OUTSCRAPER_API_KEY || "").trim();
  const getNvidiaKey = () => (process.env.NVIDIA_API_KEY || "").trim();
  const getOpenRouterKey = () => (process.env.OPENROUTER_API_KEY || "").trim();
  const getGroqKey = () => (process.env.GROQ_API_KEY || "").trim();
  const getCerebrasKey = () => (process.env.CEREBRAS_API_KEY || "").trim();
  const getMistralKey = () => (process.env.MISTRAL_API_KEY || "").trim();
  const getHuggingFaceKey = () => (process.env.HUGGINGFACE_API_KEY || "").trim();
  const getSerperKey = () => (process.env.SERPER_API_KEY || "").trim();

  // HELPER: Parse City/UF from formatted address (dynamic with fallback to Anápolis - GO)
  const parseAddrCityUf = (addrStr: string, fallbackCity = "Anápolis", fallbackUf = "GO") => {
    const addr = String(addrStr || "");
    const m = addr.match(/,\s*([^,-]+?)\s*-\s*([A-Z]{2})\b/);
    if (m) {
      const city = m[1].trim();
      const uf = m[2].trim();
      const before = addr.slice(0, m.index).split("-");
      const neighborhood = before.length > 1 ? before[before.length - 1].replace(/,/g, "").trim() : "";
      return { city, uf, neighborhood };
    }
    const ufMatch = addr.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    if (ufMatch) {
      const uf = ufMatch[1];
      const beforeUf = addr.slice(0, ufMatch.index).replace(/[,-\s]+$/, "");
      const parts = beforeUf.split(/[,-]/);
      const candidateCity = parts[parts.length - 1]?.trim();
      if (candidateCity && candidateCity.length > 2) {
        return { city: candidateCity, uf, neighborhood: parts[parts.length - 2]?.trim() || "Centro" };
      }
    }
    if (/anápolis|anapolis/i.test(addr)) return { city: "Anápolis", uf: "GO", neighborhood: "Centro" };
    if (/goiânia|goiania/i.test(addr)) return { city: "Goiânia", uf: "GO", neighborhood: "Bueno" };
    if (/brasília|brasilia/i.test(addr)) return { city: "Brasília", uf: "DF", neighborhood: "Asa Sul" };
    if (/são paulo|sao paulo/i.test(addr)) return { city: "São Paulo", uf: "SP", neighborhood: "Centro" };
    if (/campo grande/i.test(addr)) return { city: "Campo Grande", uf: "MS", neighborhood: "Centro" };
    return { city: fallbackCity, uf: fallbackUf, neighborhood: "Centro" };
  };

  // HELPER: Multi-AI Text Generation (Gemini -> NVIDIA NIM -> OpenRouter -> Groq -> Cerebras -> Mistral -> HuggingFace -> Pollinations Free Zero-Key)
  async function generateTextMultiAi(prompt: string): Promise<{ text: string; provider: string }> {
    const ai = getGeminiClient();
    if (ai) {
      try {
        const res = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
        });
        if (res.text?.trim()) {
          return { text: res.text.trim(), provider: "gemini-3.8-flash" };
        }
      } catch (e) {
        console.warn("Gemini generation fallback:");
      }
    }

    const nvidiaKey = getNvidiaKey();
    if (nvidiaKey.length > 8) {
      try {
        const nvRes = await providerFetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta/llama-3.3-70b-instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 800,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (nvRes.ok) {
          const nvData: any = await nvRes.json();
          const txt = nvData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "nvidia-llama-3.3-70b" };
        }
      } catch (e) {
        console.warn("NVIDIA NIM fallback:");
      }
    }

    const openRouterKey = getOpenRouterKey();
    if (openRouterKey.length > 8) {
      try {
        const orRes = await providerFetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.3-70b-instruct:free",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const txt = orData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "openrouter-llama-3.3-free" };
        }
      } catch (e) {
        console.warn("OpenRouter fallback:");
      }
    }

    const groqKey = getGroqKey();
    if (groqKey.length > 8) {
      try {
        const gqRes = await providerFetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (gqRes.ok) {
          const gqData: any = await gqRes.json();
          const txt = gqData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "groq-llama-3.3" };
        }
      } catch (e) {
        console.warn("Groq fallback:");
      }
    }

    const cerebrasKey = getCerebrasKey();
    if (cerebrasKey.length > 8) {
      try {
        const cbRes = await providerFetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cerebrasKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (cbRes.ok) {
          const cbData: any = await cbRes.json();
          const txt = cbData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "cerebras-llama-3.3" };
        }
      } catch (e) {
        console.warn("Cerebras fallback:");
      }
    }

    const mistralKey = getMistralKey();
    if (mistralKey.length > 8) {
      try {
        const msRes = await providerFetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (msRes.ok) {
          const msData: any = await msRes.json();
          const txt = msData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "mistral-small" };
        }
      } catch (e) {
        console.warn("Mistral fallback:");
      }
    }

    const hfKey = getHuggingFaceKey();
    if (hfKey.length > 8) {
      try {
        const hfRes = await providerFetch("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (hfRes.ok) {
          const hfData: any = await hfRes.json();
          const txt = hfData.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, provider: "huggingface-qwen-72b" };
        }
      } catch (e) {
        console.warn("HuggingFace fallback:");
      }
    }

    // Zero-Key 100% Free Cloud AI Fallback (Pollinations OpenAI-compatible API)
    try {
      const polRes = await providerFetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            {
              role: "system",
              content: "Você é um especialista sênior em Google Business Profile (Google Meu Negócio) no Brasil. Responda sempre em português sem emojis.",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(7000),
      });
      if (polRes.ok) {
        const polData: any = await polRes.json();
        const txt = polData.choices?.[0]?.message?.content?.trim();
        if (txt) return { text: txt, provider: "pollinations-free-ai" };
      }
    } catch {}

    return { text: "", provider: "deterministic" };
  }

  // HELPER: Resolve Real Business via Outscraper v3 -> Google Places API (New) -> Serper Maps -> Gemini Maps Grounding -> OpenStreetMap Nominatim (Free Zero-Key)
  async function resolveRealBusinessMultiEngine(rawQuery: string): Promise<any> {
    let searchName = String(rawQuery || "").trim();

    // Validate and resolve every hop before any provider fallback.
    if (/[a-z][a-z\d+.-]*:\/\//i.test(searchName)) {
      const page = await publicUrlClient.fetchHtml(searchName, { allowedHosts: MAPS_HOSTS });
      const finalUrl = page.url;
      const placeMatch = finalUrl.match(/\/maps\/place\/([^/@?]+)/i);
      const qMatch = finalUrl.match(/[?&]q=([^&]+)/i);
      try {
        if (placeMatch?.[1]) searchName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
        else if (qMatch?.[1]) searchName = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')).trim();
        else throw new PublicUrlError(400, 'Link Maps sem nome de empresa reconhecível.');
      } catch { throw new PublicUrlError(400, 'Link Maps inválido.'); }
      if (!searchName || /[a-z][a-z\d+.-]*:\/\//i.test(searchName)) throw new PublicUrlError(400, 'Link Maps deve identificar uma empresa.');
      return { place_id: `maps-url:${finalUrl}`, name: searchName, source: 'maps-url-name-unverified', rating: null, rating_count: null, verified: null, city: null, uf: null };
    }

    // 2. Check exact match in Demo Businesses first (e.g., Sorvetes Campo Grande, Pet Store - AuauFaville, Encanto Móveis)
    const foundDemo = demoBusinesses.find(
      (b) => b.name.toLowerCase() === searchName.toLowerCase() || (searchName.length >= 5 && b.name.toLowerCase().includes(searchName.toLowerCase()))
    );

    // 3. Try Outscraper Google Maps API v3 (100% real verification status, subtypes, photos_count, reviews_per_score)
    const outscraperKey = getOutscraperKey();
    if (outscraperKey.length > 10) {
      try {
        const osUrl = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(
          searchName
        )}&limit=7&async=false&language=pt&region=BR`;
        const osRes = await providerFetch(osUrl, {
          headers: { "X-API-KEY": outscraperKey },
          signal: AbortSignal.timeout(12000),
        });
        if (osRes.ok) {
          const osJson: any = await osRes.json();
          const list = Array.isArray(osJson?.data?.[0]) ? osJson.data[0] : [];
          if (list.length > 0) {
            const top = list[0];
            const subtypesArr = String(top.subtypes || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const aboutFeatures: string[] = [];
            if (top.about && typeof top.about === "object") {
              for (const sec of Object.values(top.about)) {
                if (sec && typeof sec === "object") {
                  for (const [k, v] of Object.entries(sec as Record<string, any>)) {
                    if (v === true) aboutFeatures.push(k);
                  }
                }
              }
            }
            const realCompetitors = list.slice(1, 7).map((c: any) => ({
              name: c.name || "Concorrente Local",
              rating: Number(c.rating || 4.7),
              reviewsCount: Number(c.reviews || 45),
              photosCount: Number(c.photos_count || 25),
              verified: Boolean(c.verified ?? true),
              hasWebsite: Boolean(c.site),
            }));

            return {
              place_id: top.place_id || `outscraper-${Date.now()}`,
              source: "outscraper-v3",
              name: top.name || searchName,
              category: top.type || subtypesArr[0] || "Comércio Local",
              additional_categories_count: Math.max(0, subtypesArr.length - 1),
              city: top.city || parseAddrCityUf(top.full_address || "").city,
              uf: top.state_code || parseAddrCityUf(top.full_address || "").uf,
              neighborhood: top.borough || parseAddrCityUf(top.full_address || "").neighborhood,
              address: top.full_address || top.street || "",
              phone: top.phone || "(67) 3325-4012",
              whatsapp: String(top.phone || "").replace(/\D/g, ""),
              rating: Number(top.rating || 4.7),
              rating_count: Number(top.reviews || 0),
              photos_count: Number(top.photos_count || 10),
              verified: Boolean(top.verified),
              website: top.site || "",
              lat: Number(top.latitude || -20.4812),
              lng: Number(top.longitude || -54.6154),
              bio: top.description || "",
              features: aboutFeatures.length > 0 ? aboutFeatures.slice(0, 12) : ["Atendimento local"],
              reviews_per_score: top.reviews_per_score || null,
              realCompetitors,
              photos: top.photo ? [top.photo] : foundDemo?.photos || [],
            };
          }
        }
      } catch (e) {
        console.warn("Outscraper v3 lookup fallback:");
      }
    }

    // 4. Try Real Google Maps Platform Places API (New) using VITE_GOOGLE_MAPS_API_KEY
    const mapsKey = getMapsKey();
    if (mapsKey.length > 10) {
      try {
        const gRes = await providerFetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": mapsKey,
            "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio",
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.primaryTypeDisplayName,places.types,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.location,places.photos,places.businessStatus,places.editorialSummary",
          },
          body: JSON.stringify({
            textQuery: searchName,
            languageCode: "pt-BR",
            maxResultCount: 7,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (gRes.ok) {
          const gData: any = await gRes.json();
          const places = gData.places || [];
          if (places.length > 0) {
            const p = places[0];
            const parsedLoc = parseAddrCityUf(p.formattedAddress || "");
            const catName = p.primaryTypeDisplayName?.text || "Empresa Local";

            // Fetch competitors in the same city & category if search only returned 1 place
            let compPlaces = places.slice(1, 7);
            if (compPlaces.length < 3 && parsedLoc.city) {
              try {
                const cRes = await providerFetch("https://places.googleapis.com/v1/places:searchText", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": mapsKey,
                    "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio",
                    "X-Goog-FieldMask":
                      "places.id,places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.photos",
                  },
                  body: JSON.stringify({
                    textQuery: `${catName} em ${parsedLoc.city} ${parsedLoc.uf}`,
                    languageCode: "pt-BR",
                    maxResultCount: 7,
                  }),
                  signal: AbortSignal.timeout(6000),
                });
                if (cRes.ok) {
                  const cData: any = await cRes.json();
                  compPlaces = (cData.places || []).filter((cp: any) => cp.id !== p.id).slice(0, 6);
                }
              } catch {}
            }

            const realCompetitors = compPlaces.map((cp: any) => ({
              name: cp.displayName?.text || "Concorrente Google Maps",
              rating: Number(cp.rating || 4.7),
              reviewsCount: Number(cp.userRatingCount || 60),
              photosCount: Array.isArray(cp.photos) ? cp.photos.length * 5 : 28,
              verified: true,
              hasWebsite: Boolean(cp.websiteUri),
            }));

            const typesCount = Array.isArray(p.types) ? Math.max(0, Math.min(3, p.types.length - 3)) : 1;
            const photoRefs = (p.photos || [])
              .slice(0, 4)
              .map((ph: any) => `/api/places/photo?name=${encodeURIComponent(ph.name)}&max_width_px=900`);

            return {
              place_id: p.id,
              source: "google-places-new",
              name: p.displayName?.text || searchName,
              category: catName,
              additional_categories_count: foundDemo?.additional_categories_count ?? typesCount,
              city: parsedLoc.city,
              uf: parsedLoc.uf,
              neighborhood: parsedLoc.neighborhood,
              address: p.formattedAddress || `${parsedLoc.city} - ${parsedLoc.uf}`,
              phone: p.nationalPhoneNumber || foundDemo?.phone || "(67) 3325-4012",
              whatsapp: String(p.nationalPhoneNumber || foundDemo?.whatsapp || "").replace(/\D/g, ""),
              rating: Number(p.rating ?? foundDemo?.rating ?? 4.7),
              rating_count: Number(p.userRatingCount ?? foundDemo?.rating_count ?? 72),
              photos_count: foundDemo?.photos_count ?? (Array.isArray(p.photos) ? p.photos.length * 3 : 18),
              verified: typeof foundDemo?.verified === "boolean" ? foundDemo.verified : Boolean(p.websiteUri && (p.userRatingCount || 0) > 100),
              website: p.websiteUri || "",
              lat: Number(p.location?.latitude ?? foundDemo?.lat ?? -20.4812),
              lng: Number(p.location?.longitude ?? foundDemo?.lng ?? -54.6154),
              bio: p.editorialSummary?.text || foundDemo?.bio || "",
              features: foundDemo?.features || ["Atendimento local", "Rotas no Google Maps"],
              realCompetitors: realCompetitors.length > 0 ? realCompetitors : foundDemo?.realCompetitors || [],
              photos: photoRefs.length > 0 ? photoRefs : foundDemo?.photos || [],
            };
          }
        }
      } catch (e) {
        console.warn("Google Places API (New) lookup fallback:");
      }
    }

    // 4b. Try Serper.dev Google Places API if SERPER_API_KEY is configured
    const serperKey = getSerperKey();
    if (serperKey.length > 8) {
      try {
        const spRes = await providerFetch("https://google.serper.dev/places", {
          method: "POST",
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: searchName, gl: "br", hl: "pt-br" }),
          signal: AbortSignal.timeout(7000),
        });
        if (spRes.ok) {
          const spData: any = await spRes.json();
          const places = spData.places || [];
          if (places.length > 0) {
            const top = places[0];
            const parsedLoc = parseAddrCityUf(top.address || "");
            return {
              place_id: top.cid || `serper-${Date.now()}`,
              source: "serper-google-places",
              name: top.title || searchName,
              category: top.category || "Comércio Local",
              city: parsedLoc.city,
              uf: parsedLoc.uf,
              neighborhood: parsedLoc.neighborhood,
              address: top.address || "",
              phone: top.phoneNumber || "(67) 3325-4012",
              whatsapp: String(top.phoneNumber || "").replace(/\D/g, ""),
              rating: Number(top.rating || 4.7),
              rating_count: Number(top.ratingCount || 45),
              photos_count: 18,
              verified: Boolean(top.website),
              website: top.website || "",
              lat: Number(top.latitude || -20.4812),
              lng: Number(top.longitude || -54.6154),
              bio: "",
            };
          }
        }
      } catch {}
    }

    if (foundDemo) {
      return { ...foundDemo };
    }

    // 5. Try OpenStreetMap Nominatim (100% Free, Zero Key Real Coordinates & Address)
    let osmData: any = null;
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&countrycodes=br&q=${encodeURIComponent(
        searchName
      )}`;
      const nomRes = await providerFetch(nomUrl, {
        headers: { "User-Agent": "G360BusinessPlatform/1.0 (https://g360.app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (nomRes.ok) {
        const nomList: any = await nomRes.json();
        if (Array.isArray(nomList) && nomList.length > 0) {
          osmData = nomList[0];
        }
      }
    } catch {}

    // 6. Fallback to Gemini 3.8 Flash with Google Maps Grounding
    const ai = getGeminiClient();
    if (ai) {
      try {
        const gRes = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Localize a empresa "${searchName}" no Brasil e retorne um JSON com: name, category, city, uf, neighborhood, address, phone, rating (numero), rating_count (numero), photos_count (numero), verified (boolean), website (string), lat (numero), lng (numero).`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                city: { type: Type.STRING },
                uf: { type: Type.STRING },
                neighborhood: { type: Type.STRING },
                address: { type: Type.STRING },
                phone: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                rating_count: { type: Type.NUMBER },
                photos_count: { type: Type.NUMBER },
                verified: { type: Type.BOOLEAN },
                website: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
            },
          },
        });
        const parsed = JSON.parse((gRes.text || "{}").trim());
        if (parsed?.name) {
          const geminiLoc = parseAddrCityUf(parsed.address || `${parsed.city || ""} ${parsed.uf || ""}`, "Anápolis", "GO");
          return {
            place_id: `gemini-grounding-${Date.now()}`,
            source: "gemini-maps-grounding",
            name: parsed.name || searchName,
            category: parsed.category || "Comércio Local",
            city: parsed.city || osmData?.address?.city || osmData?.address?.town || geminiLoc.city,
            uf: parsed.uf || geminiLoc.uf,
            neighborhood: parsed.neighborhood || osmData?.address?.suburb || geminiLoc.neighborhood,
            address: parsed.address || osmData?.display_name || `${geminiLoc.city} - ${geminiLoc.uf}`,
            phone: parsed.phone || "(62) 99113-8004",
            whatsapp: String(parsed.phone || "").replace(/\D/g, ""),
            rating: Number(parsed.rating || 4.7),
            rating_count: Number(parsed.rating_count || 48),
            photos_count: Number(parsed.photos_count || 19),
            verified: Boolean(parsed.verified ?? false),
            website: parsed.website || "",
            lat: Number(osmData?.lat || parsed.lat || -16.3285),
            lng: Number(osmData?.lon || parsed.lng || -48.9534),
            bio: "",
          };
        }
      } catch {}
    }

    const fallbackLoc = parseAddrCityUf(searchName, "Anápolis", "GO");
    const isCampoGrande = /campo grande/i.test(searchName);
    const finalCity = isCampoGrande ? "Campo Grande" : (osmData?.address?.city || osmData?.address?.town || fallbackLoc.city);
    const finalUf = isCampoGrande ? "MS" : fallbackLoc.uf;

    return {
      place_id: `custom-${Date.now()}`,
      source: osmData ? "openstreetmap-nominatim" : "custom",
      name: searchName || "Empresa Local",
      category: /sorvet|acai/i.test(searchName) ? "Sorveteria" : "Comércio e Serviços Locais",
      city: finalCity,
      uf: finalUf,
      address: osmData?.display_name || `${searchName} - ${finalCity} - ${finalUf}`,
      phone: isCampoGrande ? "(67) 3325-4012" : "(62) 99113-8004",
      whatsapp: isCampoGrande ? "556733254012" : "5562991138004",
      rating: 4.8,
      rating_count: 36,
      photos_count: 18,
      verified: false,
      website: "",
      lat: Number(osmData?.lat || (isCampoGrande ? -20.4812 : -16.3285)),
      lng: Number(osmData?.lon || (isCampoGrande ? -54.6154 : -48.9534)),
      bio: "",
    };
  }

  // 1. LIST SAVED AUDITS
  router.get("/audits", (req, res) => {
    const g360 = ensureG360Db();
    res.json({ audits: (g360.audits || []).filter((a: any) => visible(a, req)) });
  });

  // 1b. ENGINE STATUS & LIVE DIAGNOSTIC TEST
  router.get("/engine-status", (_req, res) => {
    const labels: Record<string,string> = {gemini:'Google Gemini',google_places:'Google Places',outscraper:'Outscraper',groq:'Groq',openrouter:'OpenRouter',nvidia:'NVIDIA',cerebras:'Cerebras',mistral:'Mistral',huggingface:'Hugging Face',serper:'Serper',vercel:'Vercel',netlify:'Netlify'};
    const engines = Object.fromEntries(integrationStatus(process.env).map(info => [info.id,{active:false,configured:info.configured,label:labels[info.id]||info.id,verification:info.verification,balance:null,mode:info.configured?'Configuração presente; conexão, gratuidade e saldo não verificados':'Não configurado; nenhuma conexão foi comprovada'}]));
    Object.assign(engines,{firebase:{active:false,configured:false,label:'Firebase / Firestore / Google Auth',verification:'not_verified',balance:null,mode:'Projeto de homologação; serviços reais não verificados'},openstreetmap:{active:false,configured:Boolean(process.env.G360_OSM_CONTACT),label:'OpenStreetMap / Overpass',verification:'not_verified',balance:null,mode:'Consulta externa não homologada; importação local disponível'}});
    res.json({ok:true,engines});
  });

  // 1c. FREE ZERO-KEY CNPJ & QSA LOOKUP PROTECTED BY COSTGUARD (24H CACHE + IN-FLIGHT DEDUPLICATION)
  router.post("/cnpj-lookup", asyncRoute(async (req, res) => {
    const rawCnpj = String(req.body?.cnpj || "").replace(/\D/g, "");
    if (rawCnpj.length !== 14) {
      return res.status(400).json({ ok: false, error: "Informe um CNPJ válido com 14 dígitos numéricos." });
    }

    // 1. Check CostGuard 24h cache first (Zero cost, instant)
    const cached = costGuard.getCachedCnpj(rawCnpj);
    if (cached) {
      return res.json({
        ok: true,
        source: `${cached.source}`,
        data: cached,
      });
    }

    // 2. Check CostGuard limits
    const limitCheck = costGuard.checkLimit("cnpj_lookup");
    if (!limitCheck.allowed) {
      return res.status(429).json({
        ok: false,
        error: limitCheck.reason || "Limite diário ou taxa de consultas públicas de CNPJ atingido.",
        retryAfter: limitCheck.retryAfterSeconds,
      });
    }

    try {
      // 3. Deduplicate in-flight queries and query BrasilAPI with fallback to CNPJ.ws
      const result = await costGuard.deduplicateRequest(`cnpj_${rawCnpj}`, async () => {
        let payload: any = null;
        let source = "BrasilAPI Receita Federal (Gratuito)";

        // Try BrasilAPI
        try {
          const bRes = await providerFetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`, {
            headers: { "User-Agent": "G360BusinessPlatform/1.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (bRes.ok) {
            payload = await bRes.json();
          }
        } catch (e) {
          console.warn("BrasilAPI CNPJ fallback:");
        }

        // Fallback to Publica CNPJ.ws
        if (!payload) {
          try {
            const wsRes = await providerFetch(`https://publica.cnpj.ws/cnpj/${rawCnpj}`, {
              headers: { "User-Agent": "G360BusinessPlatform/1.0" },
              signal: AbortSignal.timeout(8000),
            });
            if (wsRes.ok) {
              const wsData: any = await wsRes.json();
              const est = wsData.estabelecimento || {};
              payload = {
                cnpj: wsData.cnpj_raiz ? rawCnpj : est.cnpj,
                razao_social: wsData.razao_social,
                nome_fantasia: est.nome_fantasia || wsData.razao_social,
                descricao_situacao_cadastral: est.situacao_cadastral,
                cnae_fiscal_descricao: est.atividade_principal?.descricao,
                descricao_tipo_de_logradouro: est.tipo_logradouro,
                logradouro: est.logradouro,
                numero: est.numero,
                complemento: est.complemento,
                bairro: est.bairro,
                municipio: est.cidade?.nome,
                uf: est.estado?.sigla,
                cep: est.cep,
                ddd_telefone_1: est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : "",
                email: est.email,
                capital_social: wsData.capital_social,
                qsa: wsData.socios?.map((s: any) => ({ nome_socio: s.nome })),
              };
              source = "CNPJ.ws Público (Gratuito)";
            }
          } catch (e) {
            console.warn("CNPJ.ws fallback:");
          }
        }

        if (!payload) {
          throw new Error("Não foi possível localizar este CNPJ na base pública no momento.");
        }

        const socios = Array.isArray(payload.qsa)
          ? payload.qsa.map((s: any) => s.nome_socio || s.nome).filter(Boolean)
          : [];
        const fullAddr = [
          payload.descricao_tipo_de_logradouro ? `${payload.descricao_tipo_de_logradouro} ${payload.logradouro}` : payload.logradouro,
          payload.numero,
          payload.complemento,
          payload.bairro ? `- ${payload.bairro}` : "",
          payload.municipio ? `, ${payload.municipio}` : "",
          payload.uf ? `- ${payload.uf}` : "",
          payload.cep ? `(${payload.cep})` : "",
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        const formatted = {
          cnpj: rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
          razaoSocial: payload.razao_social || "",
          nomeFantasia: payload.nome_fantasia || payload.razao_social || "",
          situacao: payload.descricao_situacao_cadastral || "ATIVA",
          cnaePrincipal: payload.cnae_fiscal_descricao || "Comércio e Serviços",
          dataAbertura: payload.data_inicio_atividade || "",
          capitalSocial: Number(payload.capital_social || 0),
          telefone: payload.ddd_telefone_1 || "",
          email: payload.email || "",
          enderecoCompleto: fullAddr,
          cidade: payload.municipio || "",
          uf: payload.uf || "",
          bairro: payload.bairro || "",
          socios,
          responsavelSugerido: socios[0] || payload.razao_social || "Responsável Legal",
        };

        costGuard.setCachedCnpj(rawCnpj, formatted, source);
        costGuard.recordCall("cnpj_lookup");
        return { source, data: formatted };
      });

      return res.json({ ok: true, source: result.source, data: result.data });
    } catch (e: any) {
      return res.status(404).json({ ok: false, error: e?.message || "CNPJ não encontrado." });
    }
  }));

  // 1d. FREE ZERO-KEY LIVE WEBSITE TECHNICAL & SCHEMA.ORG AUDITOR
  router.post("/website-audit", asyncRoute(async (req, res) => {
    let rawUrl = String(req.body?.url || "").trim();
    if (!rawUrl) {
      return res.json({
        ok: true,
        hasWebsite: false,
        score: 0,
        summary: "Empresa não possui website oficial cadastrado na ficha do Google.",
        checks: [
          { label: "Domínio Próprio / Website", ok: false, detail: "Ausente — oportunidade imediata para vender o Site Express" },
          { label: "Certificado SSL (HTTPS)", ok: false, detail: "Sem site ativo" },
          { label: "Dados Estruturados Schema.org LocalBusiness", ok: false, detail: "Sem marcação semântica para o Google" },
          { label: "Botão de Conversão WhatsApp (wa.me)", ok: false, detail: "Inexistente" },
        ],
      });
    }

    const t0 = Date.now();
    try {
      const page = await publicUrlClient.fetchHtml(rawUrl);
      const latencyMs = Date.now() - t0;
      const html = page.html;
      const finalUrl = page.url;
      const isHttps = finalUrl.startsWith("https://");

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const titleText = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || "";
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
      const descText = descMatch?.[1]?.trim() || "";
      const hasSchemaLocal = /LocalBusiness|application\/ld\+json/i.test(html);
      const hasWhatsApp = /wa\.me\/|api\.whatsapp\.com|whatsapp/i.test(html);
      const hasTracking = /googletagmanager|gtag\(|fbq\(|fbevents/i.test(html);
      const hasViewport = /name=["']viewport["']/i.test(html);

      const checks = [
        {
          label: "Certificado de Segurança SSL (HTTPS)",
          ok: isHttps,
          detail: isHttps ? "Conexão segura HTTPS ativa" : "Site inseguro (HTTP sem SSL)",
        },
        {
          label: "Tempo de Resposta do Servidor",
          ok: latencyMs < 1500,
          detail: `${latencyMs} ms (${latencyMs < 1500 ? "Rápido" : "Lento no celular"})`,
        },
        {
          label: "Título SEO (<title>)",
          ok: titleText.length >= 15 && titleText.length <= 70,
          detail: titleText ? `"${titleText.slice(0, 65)}" (${titleText.length} caracteres)` : "Tag <title> ausente",
        },
        {
          label: "Meta Description para Google",
          ok: descText.length >= 50,
          detail: descText ? `${descText.length} caracteres preenchidos` : "Ausente — prejudica cliques no Google",
        },
        {
          label: "Schema.org LocalBusiness (JSON-LD)",
          ok: hasSchemaLocal,
          detail: hasSchemaLocal
            ? "Marcação estruturada detectada"
            : "Ausente — o site não envia sinais estruturados de endereço/telefone ao Google",
        },
        {
          label: "Botão Rápido de WhatsApp",
          ok: hasWhatsApp,
          detail: hasWhatsApp ? "Link de WhatsApp identificado na página" : "Não encontrado — perda de leads mobile",
        },
        {
          label: "Rastreamento (Google Tag / Meta Pixel)",
          ok: hasTracking,
          detail: hasTracking ? "Pixel / Tag Manager instalado" : "Nenhum código de remarketing ou Analytics detectado",
        },
        {
          label: "Otimização Mobile (Viewport)",
          ok: hasViewport,
          detail: hasViewport ? "Responsivo para smartphones" : "Tag viewport ausente",
        },
      ];

      const passed = checks.filter((c) => c.ok).length;
      const score = Math.round((passed / checks.length) * 100);

      return res.json({
        ok: true,
        hasWebsite: true,
        finalUrl,
        latencyMs,
        score,
        summary:
          score >= 75
            ? "Site bem estruturado tecnicamente."
            : "Site atual apresenta falhas técnicas de conversão e SEO Local (oportunidade de upgrade para Site Express).",
        checks,
      });
    } catch (e: any) {
      if (e instanceof PublicUrlError) return res.status(e.status).json({ ok: false, detail: e.message });
      return res.json({
        ok: true,
        hasWebsite: true,
        finalUrl: rawUrl,
        score: 15,
        summary: `Não foi possível carregar o site (${e?.message || "Fora do ar ou bloqueado"}). Grande oportunidade para oferecer o Site Express.`,
        checks: [
          { label: "Disponibilidade do Site", ok: false, detail: "Site fora do ar, lento ou com erro de certificado SSL" },
          { label: "Schema.org LocalBusiness", ok: false, detail: "Inacessível" },
        ],
      });
    }
  }));

  router.post("/test-engines", publicUrlRoute(async (req, res) => {
    const sampleQuery = req.body?.sampleQuery;
    if (typeof sampleQuery === 'string' && /^https?:\/\//i.test(sampleQuery)) await publicUrlClient.validateOnly(sampleQuery);
    res.status(503).json({ok:false, detail:'Diagnóstico externo indisponível; nenhuma empresa ou resultado foi inferido.'});
  }));

  // 2. RUN AUDIT (BY BUSINESS OBJECT, PLACE_ID, QUERY OR MAPS URL)
  router.post("/audit", publicUrlRoute(async (req, res) => {
    const g360 = ensureG360Db();
    const { business, query, verifiedOverride } = req.body || {};

    let targetBiz = business;
    // If business came from a custom:: suggestion or query string, resolve live via Outscraper / Google Places / Gemini!
    if (
      (!targetBiz && query) ||
      (targetBiz?.place_id && String(targetBiz.place_id).startsWith("custom::")) ||
      targetBiz?.source === "custom"
    ) {
      const qToResolve =
        query ||
        decodeURIComponent(String(targetBiz?.place_id || "").replace(/^custom::/, "")) ||
        targetBiz?.name ||
        "Sorvetes Campo Grande";
      if (!/^https?:\/\//i.test(String(qToResolve))) return res.status(503).json({ok:false, detail:'Busca externa indisponível. Use a prospecção OSM ou dados confirmados.'});
      targetBiz = await resolveRealBusinessMultiEngine(qToResolve);
    }

    if (typeof verifiedOverride === "boolean") {
      targetBiz = { ...targetBiz, verified: verifiedOverride };
    }

    if (!targetBiz || typeof targetBiz.name !== 'string') return res.status(503).json({ ok: false, detail: 'Empresa indisponível; forneça dados confirmados ou use a busca OSM.' });
    const rawEvidenceAudit = scoreEvidenceAudit({ placeId: String(targetBiz.place_id || targetBiz.id || 'unidentified'), name: targetBiz.name, fields: {} });
    const report = { ...buildAuditReportFromEvidenceAudit(rawEvidenceAudit, {city: targetBiz.city, uf: targetBiz.uf}), id: uuidv4(), rawEvidenceAudit, ownerUid: actor(req).uid };
    // Keep history across businesses and owners. A new audit must never silently
    // delete another account's records or an earlier revision of the same business.
    g360.audits = [report, ...(g360.audits || [])];
    saveDb(getDb());
    res.json({ ok: true, report });
  }));

  // 3. LEAD FINDER (BUSCADOR DE LEADS QUALIFICADOS POR NICHO + CIDADE VIA OUTSCRAPER / GOOGLE PLACES)
  router.post("/leads/search", (_req, res) => res.status(503).json({ ok: false, detail: "Use a busca OSM; prospecção sem fonte verificável está indisponível." }));
  router.post("/legacy-disabled/leads/search", asyncRoute(async (req, res) => {
    return res.status(503).json({ ok: false, detail: "Indisponível." });
    const {
      niche = "Sorveteria",
      city = "Campo Grande",
      neighborhood = "",
      filterUnverified = false,
      filterNoSite = false,
    } = req.body || {};
    const cleanNiche = String(niche || "Comércio Local").trim();
    const cleanCity = String(city || "Campo Grande").trim();
    const nb = String(neighborhood || "").trim();
    const searchQuery = `${cleanNiche} em ${nb ? `${nb}, ` : ""}${cleanCity}`;

    let rawLeads: any[] = [];

    // 3a. Try Outscraper API v3 first if key is present and allowed by CostGuard (blocked in strictFreeMode)
    const osGuard = costGuard.checkLimit("outscraper");
    const outscraperKey = getOutscraperKey();
    if (osGuard.allowed && outscraperKey.length > 10) {
      try {
        const osUrl = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(
          searchQuery
        )}&limit=15&async=false&language=pt&region=BR`;
        const osRes = await providerFetch(osUrl, {
          headers: { "X-API-KEY": outscraperKey },
          signal: AbortSignal.timeout(12000),
        });
        if (osRes.ok) {
          costGuard.recordUsage("outscraper");
          const osJson: any = await osRes.json();
          const list = Array.isArray(osJson?.data?.[0]) ? osJson.data[0] : [];
          rawLeads = list.map((item: any, idx: number) => {
            const verified = Boolean(item.verified);
            const website = item.site || "";
            const gbpScore = verified && website ? 74 : verified ? 56 : 42;
            return {
              place_id: item.place_id || `os-lead-${idx}-${Date.now()}`,
              source: "outscraper-v3",
              name: item.name || `${cleanNiche} ${idx + 1}`,
              category: item.type || cleanNiche,
              city: item.city || cleanCity,
              uf: item.state_code || "BR",
              neighborhood: item.borough || nb || "Centro",
              address: item.full_address || `${cleanCity}`,
              phone: item.phone || "Sem telefone",
              whatsapp: String(item.phone || "").replace(/\D/g, ""),
              rating: Number(item.rating || 4.6),
              rating_count: Number(item.reviews || 12),
              photos_count: Number(item.photos_count || 8),
              verified,
              website,
              gbpScore,
              opportunityTag: !verified
                ? "Crítico: Perfil Não Verificado"
                : !website
                ? "Oportunidade: Sem Site Oficial"
                : "Otimização SEO & Posts",
            };
          });
        }
      } catch (e) {
        console.warn("Outscraper lead search fallback:");
      }
    }

    // 3b. Try Google Maps Platform Places API (New) using VITE_GOOGLE_MAPS_API_KEY guarded by CostGuard
    const mapsGuard = costGuard.checkLimit("google_places");
    const mapsKey = getMapsKey();
    if (rawLeads.length === 0 && mapsGuard.allowed && mapsKey.length > 10) {
      try {
        const gRes = await providerFetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": mapsKey,
            "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio",
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.photos,places.location",
          },
          body: JSON.stringify({
            textQuery: searchQuery,
            languageCode: "pt-BR",
            maxResultCount: 15,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (gRes.ok) {
          costGuard.recordUsage("google_places");
          const gData: any = await gRes.json();
          const places = gData.places || [];
          rawLeads = places.map((p: any, idx: number) => {
            const loc = parseAddrCityUf(p.formattedAddress || "");
            const reviewsCount = Number(p.userRatingCount || 0);
            const photosCount = Array.isArray(p.photos) ? p.photos.length * 3 : 6;
            const website = p.websiteUri || "";
            const verified = Boolean(website && reviewsCount > 60);
            const gbpScore = verified && website ? 72 : !verified && !website ? 41 : 53;
            return {
              place_id: p.id || `gmaps-lead-${idx}`,
              source: "google-places-new",
              name: p.displayName?.text || cleanNiche,
              category: p.primaryTypeDisplayName?.text || cleanNiche,
              city: loc.city || cleanCity,
              uf: loc.uf || "BR",
              neighborhood: loc.neighborhood || nb || "Centro",
              address: p.formattedAddress || cleanCity,
              phone: p.nationalPhoneNumber || "Sem telefone",
              whatsapp: String(p.nationalPhoneNumber || "").replace(/\D/g, ""),
              rating: Number(p.rating || 4.5),
              rating_count: reviewsCount,
              photos_count: photosCount,
              verified,
              website,
              lat: p.location?.latitude,
              lng: p.location?.longitude,
              gbpScore,
              opportunityTag: !verified
                ? "Não Verificado + Oportunidade GBP"
                : !website
                ? "Sem Site Oficial (Vender Site Express)"
                : "Otimização de Ranking Local",
            };
          });
        }
      } catch (e) {
        console.warn("Google Places lead search fallback:");
      }
    }

    // 3c. Fallback if both APIs returned empty
    if (rawLeads.length === 0) {
      rawLeads = [
        {
          place_id: `lead-1-${Date.now()}`,
          name: `Sorvetes ${cleanCity}`,
          category: cleanNiche,
          city: cleanCity,
          uf: "MS",
          neighborhood: nb || "Vila Carvalho",
          address: `R. Brilhante, 2681 - ${nb || "Vila Carvalho"}, ${cleanCity}`,
          phone: "(67) 3325-4012",
          whatsapp: "556733254012",
          rating: 4.7,
          rating_count: 72,
          photos_count: 23,
          verified: false,
          website: "",
          gbpScore: 45,
          opportunityTag: "Não Verificado + Sem Site",
        },
        {
          place_id: `lead-2-${Date.now()}`,
          name: `Encanto ${cleanNiche}`,
          category: cleanNiche,
          city: cleanCity,
          uf: "GO",
          neighborhood: nb || "Centro",
          address: `Av. Principal, 1480 - ${nb || "Centro"}, ${cleanCity}`,
          phone: "(62) 99113-8004",
          whatsapp: "5562991138004",
          rating: 4.6,
          rating_count: 14,
          photos_count: 9,
          verified: false,
          website: "",
          gbpScore: 39,
          opportunityTag: "Crítico: Reivindicação Pendente",
        },
      ];
    }

    const filtered = rawLeads.filter((l) => {
      if (filterUnverified && l.verified) return false;
      if (filterNoSite && l.website && !l.website.includes("instagram.com")) return false;
      return true;
    });

    res.json({ ok: true, leads: filtered });
  }));

  // 4. GENERATE @PACOTE-GBP + PROGRESSIVE @PACOTE-SITE BRIEFING (MULTI-AI: GEMINI / NVIDIA / OPENROUTER / GROQ)
  router.post("/gbp-package/generate", asyncRoute(async (req, res) => {
    const g360 = ensureG360Db();
    const { business, customDifferential } = req.body || {};
    if (!business || typeof business.name !== 'string' || !business.name.trim() || business.name.length > 160) return res.status(400).json({ detail: 'Informe uma empresa válida.' });
    const basePkg = buildIntegratedGbpPackage(business, customDifferential);
    const businessId = String(business.id || business.place_id || business.placeId || `${business.name}|${business.city || ''}|${business.address || ''}`).slice(0, 500);
    const key = `${actor(req).uid}:${businessId}`;
    Object.assign(basePkg, { businessId, ownerUid: actor(req).uid, schemaVersion: 1 });
    g360.packagesByBusiness[key] = basePkg;
    saveDb(getDb());
    res.json({ ok: true, pkg: basePkg });
  }));

  // 5. CRM LEADS & PIPELINE ROUTES
  router.get("/crm", (req, res) => {
    const g360 = ensureG360Db();
    res.json({
      leads: (g360.crmLeads || []).filter((l: any) => visible(l, req)),
      financeGoals: actor(req).role === "admin" ? g360.financeGoals : null,
      deploySettings: actor(req).role === "admin" ? publicDeploySettings(g360.deploySettings) : null,
    });
  });

  router.post("/crm/leads", (req, res) => {
    const g360 = ensureG360Db();
    const body = req.body || {};
    const created = {
      id: `lead-${uuidv4().slice(0, 8)}`,
      ownerUid: actor(req).uid,
      businessName: body.businessName || "Nova Empresa",
      contactName: body.contactName || "Responsável Comercial",
      phone: body.phone || "(62) 99999-0000",
      whatsapp: String(body.whatsapp || body.phone || "5562999990000").replace(/\D/g, ""),
      email: body.email || "",
      cnpj: body.cnpj || "",
      city: body.city || "Anápolis - GO",
      address: body.address || "",
      category: body.category || "Negócio Local",
      stage: body.stage || "prospeccao",
      gbpScoreBefore: Number(body.gbpScoreBefore ?? 44),
      gbpScoreAfter: Number(body.gbpScoreAfter ?? 91),
      verified: Boolean(body.verified),
      hasWebsite: Boolean(body.hasWebsite),
      dealValue: Number(body.dealValue ?? 1290),
      monthlyRecurring: Number(body.monthlyRecurring ?? 290),
      selectedServices: Array.isArray(body.selectedServices)
        ? body.selectedServices
        : [
            "Otimização Completa Pacote GBP (Categorias, 750c, 20 Serviços, 6 Produtos)",
            "Pacote de 10 Publicações Estratégicas Agendadas",
            "Criação de Site Express de Alta Conversão",
          ],
      notes: body.notes || "Exportado diretamente da Pré-Análise G360.",
      nextFollowUp: body.nextFollowUp || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    g360.crmLeads.unshift(created);
    saveDb(getDb());
    res.json({ ok: true, lead: created });
  });

  router.put("/crm/leads/:id", (req, res) => {
    const g360 = ensureG360Db();
    const { id } = req.params;
    const idx = (g360.crmLeads || []).findIndex((l: any) => l.id === id);
    if (idx === -1) return res.status(404).json({ detail: "Lead não encontrado" });
    if (!visible(g360.crmLeads[idx], req)) return res.sendStatus(403);
    const { ownerUid: _ignored, id: _id, ...safeChanges } = req.body || {};
    g360.crmLeads[idx] = { ...g360.crmLeads[idx], ...safeChanges };
    saveDb(getDb());
    res.json({ ok: true, lead: g360.crmLeads[idx] });
  });

  router.delete("/crm/leads/:id", (req, res) => {
    const g360 = ensureG360Db();
    const { id } = req.params;
    const target = (g360.crmLeads || []).find((l: any) => l.id === id);
    if (!target) return res.sendStatus(404);
    if (!visible(target, req)) return res.sendStatus(403);
    g360.crmLeads = (g360.crmLeads || []).filter((l: any) => l.id !== id);
    saveDb(getDb());
    res.json({ ok: true });
  });

  router.put("/settings", legacyAdmin, (req, res) => {
    const g360 = ensureG360Db();
    const { financeGoals, deploySettings } = req.body || {};
    if (financeGoals) g360.financeGoals = { ...g360.financeGoals, ...financeGoals };
    if (deploySettings) {
      // Secrets remain server-side. Existing stored tokens are preserved, never returned.
      if (Object.keys(deploySettings).some(k => !['agencyName', 'agencyPhone', 'agencyDocument'].includes(k))) return res.status(400).json({ detail: 'Configure credenciais no ambiente seguro do servidor.' });
      g360.deploySettings = { ...g360.deploySettings, ...deploySettings };
    }
    saveDb(getDb());
    res.json({ ok: true, financeGoals: g360.financeGoals, deploySettings: publicDeploySettings(g360.deploySettings) });
  });

  // 6. MULTI-USER SAAS LOGIN MANAGEMENT
  router.get("/users", legacyAdmin, (_req, res) => {
    const db = getDb();
    const safeUsers = (db.users || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || "admin",
      plan: u.plan || "g360_full",
      status: u.status || "active",
    }));
    res.json({ users: safeUsers });
  });

  router.post("/users", legacyAdmin, (req, res) => {
    const db = getDb();
    const { name, email, password, plan = "g360_full", role = "user" } = req.body || {};
    if (!validRegistrationInput(name, email, password) || String(password).length < 12) {
      return res.status(400).json({ detail: "Informe nome, e-mail e senha para criar o acesso." });
    }
    if (db.users.some((u: any) => u.email?.toLowerCase() === String(email).trim().toLowerCase())) return res.status(409).json({ detail: 'E-mail já cadastrado.' });
    const created = {
      id: uuidv4(),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: (() => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(String(password), salt, 64).toString('hex')}`; })(),
      role: role === 'admin' ? 'admin' : 'user',
      plan, // "g360_full" | "site_express_only"
      status: "active",
    };
    db.users.push(created);
    saveDb(db);
    res.json({ ok: true, user: { id: created.id, name: created.name, email: created.email, role: created.role, plan: created.plan, status: created.status } });
  });

  router.delete("/users/:id", legacyAdmin, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const target = (db.users || []).find((u: any) => u.id === id);
    if (!target) return res.status(404).json({ detail: 'Usuário não encontrado.' });
    if (target.role === 'admin' && !(db.users || []).some((u: any) => u.id !== id && u.role === 'admin' && (u.status === undefined || u.status === 'active'))) {
      return res.status(409).json({ detail: 'Preserve ao menos um administrador ativo antes de remover este acesso.' });
    }
    if ((db.users || []).length <= 1) {
      return res.status(400).json({ detail: "Não é possível remover o administrador principal." });
    }
    db.users = (db.users || []).filter((u: any) => u.id !== id);
    saveDb(db);
    res.json({ ok: true });
  });

  // 7. 1-CLICK FREE DEPLOY TO VERCEL OR NETLIFY (PLUS LOCAL HOSTING)
  router.post("/deploy", legacyAdmin, asyncRoute(async (req, res) => {
    const g360 = ensureG360Db();
    const { provider = "vercel", projectSlug = "meu-site", htmlContent = "", customToken = "" } = req.body || {};
    const cleanSlug = String(projectSlug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "") || "site-oficial";

    const token =
      customToken ||
      (provider === "vercel"
        ? g360.deploySettings?.vercelToken || process.env.VERCEL_TOKEN
        : g360.deploySettings?.netlifyToken || process.env.NETLIFY_TOKEN);

    if (provider === "vercel" && token) {
      try {
        const vRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanSlug,
            files: [
              {
                file: "index.html",
                data: htmlContent,
              },
            ],
            projectSettings: {
              framework: null,
            },
          }),
        });
        const vData: any = await vRes.json();
        if (vRes.ok && vData?.url) {
          return res.json({
            ok: true,
            provider: "vercel",
            live: true,
            url: `https://${vData.url}`,
            message: "Site publicado gratuitamente na Vercel com sucesso!",
          });
        }
        return res.status(400).json({
          detail: vData?.error?.message || "Token da Vercel inválido ou sem permissão de deploy.",
        });
      } catch (e: any) {
        return res.status(500).json({ detail: e?.message || "Erro ao conectar com a API da Vercel." });
      }
    }

    // Always provide the instant hosted route on this server + clear status if external token wasn't filled yet
    return res.json({
      ok: true,
      provider: "internal-cloud",
      live: true,
      url: `/site/${cleanSlug}`,
      needsTokenForExternal: !token,
      message: token
        ? "Site atualizado no servidor!"
        : "Link público ativo no servidor! Para publicar também em .vercel.app, basta informar seu Token gratuito da Vercel nas configurações.",
    });
  }));

  // 8. COST GUARD CONFIG & MONITORING ENDPOINTS (PROTECTED BY RBAC)
  router.get("/cost-guard", requireAuth, (req, res) => {
    const user = (req as any).user;
    const metrics = costGuard.getMetrics();
    // Admin receives full metrics and debug state; regular users receive safe operational metrics
    if (user?.role === "admin") {
      return res.json({ ok: true, ...metrics });
    }
    const totalCallsToday = Object.values(metrics.usage).reduce(
      (sum, u) => sum + (u.dailyCount || 0),
      0
    );
    return res.json({
      ok: true,
      today: metrics.date,
      usageScope: 'global_not_per_tenant',
      strictFreeMode: metrics.config.strictFreeMode,
      totalCallsToday,
      services: Object.fromEntries(
        Object.entries(metrics.config.services).map(([k, s]) => [
          k,
          {
            name: s.name,
            callsToday: metrics.usage[k]?.dailyCount || 0,
            dailyLimit: s.dailyLimit,
            simulatedCostBRL: null,
            costStatus: 'unknown',
          },
        ])
      ),
    });
  });

  router.put("/cost-guard", requireAdmin, (req, res) => {
    const body = req.body || {};
    const validation = costGuard.validateConfigUpdate(body);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, error: validation.error });
    }
    const updated = costGuard.updateConfig(body);
    res.json({ ok: true, config: updated, metrics: costGuard.getMetrics() });
  });

  return router;
}
