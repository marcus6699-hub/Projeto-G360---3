import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAuditInput,
  evaluateMathematicalCriteria,
  buildPreAndProjectedContracts,
  applyValidatedAiRedaction,
  runDeterministicAuditorEngine,
} from "./auditorEngine.ts";
import { buildG360AuditReport, buildGbpOptimizationPackage } from "./g360Engine.ts";

const NOW_ISO = "2026-10-29T12:00:00.000Z";
const RECENT_POST_DATE = "2026-10-20T10:00:00.000Z"; // 9 days ago
const OLD_POST_DATE = "2026-08-01T10:00:00.000Z"; // > 30 days ago

function makeCompleteApprovedBusiness(overrides: Record<string, any> = {}) {
  const twentyAnsweredReviews = Array.from({ length: 20 }, (_, i) => ({
    rating: 5,
    date: `2026-10-${String(28 - (i % 20)).padStart(2, "0")}T12:00:00Z`,
    text: `Excelente serviço #${i + 1}`,
    review_answer_text: `Obrigado pela preferência, cliente #${i + 1}!`,
  }));

  return {
    source: "outscraper-v3",
    queryCompleted: true,
    name: "Jonas Gás e Água",
    city: "Campo Grande",
    uf: "MS",
    address: "Av. Afonso Pena, 1500 - Centro, Campo Grande - MS",
    website: "https://jonasgas.com.br",
    phone: "(67) 3325-9000",
    opening_hours: ["Segunda a Sábado: 08:00 – 20:00"],
    category: "Companhia de gás",
    confirmedPrimaryActivity: "Distribuidora de gás de cozinha",
    categories: ["Companhia de gás", "Distribuidora de gás GLP", "Fornecedor de água mineral"],
    rating: 4.8,
    reviews_count: 45,
    reviews_data: twentyAnsweredReviews,
    photos_count: 22,
    posts_data: [{ date: RECENT_POST_DATE, text: "Entrega rápida de gás GLP em Campo Grande." }],
    description: "Distribuidora autorizada de gás de cozinha e água mineral em Campo Grande.",
    ...overrides,
  };
}

// 1. Perfil completo com todos os critérios confirmados e aprovados -> nota 100
test("1. Perfil completo com todos os critérios confirmados e aprovados resulta em nota 100 definitiva e cobertura 100%", () => {
  const contract = runDeterministicAuditorEngine(makeCompleteApprovedBusiness(), { collectedAt: NOW_ISO });
  assert.equal(contract.pre_analise.nota_calculada, 100);
  assert.equal(contract.pre_analise.nota_definitiva, true);
  assert.equal(contract.pre_analise.cobertura_percentual, 100);
  assert.equal(contract.pre_analise.soma_penalidades_confirmadas, 0);
  assert.deepEqual(contract.pre_analise.intervalo_possivel, { minimo: 100, maximo: 100 });
  assert.equal(contract.pre_analise.erros_criticos.length, 0);
});

// 2. Site comprovadamente ausente -> -10
test("2. Site comprovadamente ausente aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ website: "" }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const webCrit = contract.pre_analise.criterios.find((c) => c.id === "website");
  assert.equal(webCrit?.penalidade, 10);
  assert.equal(webCrit?.status, "ABSENT");
});

// 3. Telefone ausente -> -10
test("3. Telefone comprovadamente ausente aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ phone: "" }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "phone_hours");
  assert.equal(crit?.penalidade, 10);
});

// 4. Horário de funcionamento ausente -> -10
test("4. Horário de funcionamento comprovadamente ausente aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ opening_hours: [] }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "phone_hours");
  assert.equal(crit?.penalidade, 10);
});

// 5. Telefone e horário ausentes -> dedução única de 10 pontos
test("5. Telefone e horário simultaneamente ausentes geram dedução máxima única de 10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ phone: null, opening_hours: null }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "phone_hours");
  assert.equal(crit?.penalidade, 10);
  assert.equal(crit?.pontosObtidos, 0);
});

// 6. Categoria principal incompatível -> -20
test("6. Categoria principal comprovadamente incompatível com a atividade central aplica -20 pontos (nota 80)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      category: "Fornecedor de móveis planejados",
      confirmedPrimaryActivity: "Distribuidora de gás de cozinha e água mineral",
    }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 80);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "primary_category");
  assert.equal(crit?.penalidade, 20);
});

// 7. Categoria secundária desnecessária -> nenhuma dedução
test("7. Empresa sem necessidade de categorias secundárias não sofre dedução (nota 100)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      categories: ["Companhia de gás"],
      confirmedSecondaryActivities: [],
      secondaryCategoriesMissingConfirmed: false,
    }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "secondary_categories");
  assert.equal(crit?.penalidade, 0);
});

// 8. Categorias secundárias úteis ausentes -> -10
test("8. Atividades secundárias comprovadas sem categorias secundárias correspondentes aplicam -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      categories: ["Companhia de gás"],
      confirmedSecondaryActivities: ["Entrega de água mineral", "Recarga de botijão P13"],
    }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "secondary_categories");
  assert.equal(crit?.penalidade, 10);
});

// 9. Nota média 4,49 -> -10
test("9. Nota média 4.49 (abaixo de 4.5) aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ rating: 4.49 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "rating");
  assert.equal(crit?.penalidade, 10);
});

// 10. Nota média 4,50 -> nenhuma dedução
test("10. Nota média 4.50 exata não sofre dedução (nota 100)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ rating: 4.5 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "rating");
  assert.equal(crit?.penalidade, 0);
});

// 11. Total de 19 avaliações -> -10
test("11. Total de 19 avaliações (< 20) aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ reviews_count: 19 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "reviews_count");
  assert.equal(crit?.penalidade, 10);
});

// 12. Total de 20 avaliações -> nenhuma dedução
test("12. Total de 20 avaliações (>= 20) não sofre dedução (nota 100)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ reviews_count: 20 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "reviews_count");
  assert.equal(crit?.penalidade, 0);
});

// 13. Taxa de resposta de 79% -> -10
test("13. Taxa de resposta do proprietário de 79% (< 80%) aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ owner_response_rate_pct: 79, analyzed_reviews_count: 20 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "owner_responses");
  assert.equal(crit?.penalidade, 10);
});

// 14. Taxa de resposta de 80% -> nenhuma dedução
test("14. Taxa de resposta do proprietário de 80% (>= 80%) não sofre dedução (nota 100)", () => {
  const rawReviews = Array.from({ length: 20 }, (_, idx) => ({
    rating: 5,
    date: `2026-10-${String(28 - idx).padStart(2, "0")}T10:00:00Z`,
    text: "Muito bom",
    owner_answer: idx < 16 ? "Muito obrigado pela avaliação!" : null, // 16/20 = 80%
  }));
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ reviews_data: rawReviews }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "owner_responses");
  assert.equal(crit?.penalidade, 0);
});

// 15. Menos de 15 fotos -> -10
test("15. Quantidade de fotos inferior a 15 (14 fotos) aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ photos_count: 14 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "photos_count");
  assert.equal(crit?.penalidade, 10);
});

// 16. 15 fotos -> nenhuma dedução
test("16. Quantidade de fotos igual a 15 não sofre dedução (nota 100)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ photos_count: 15 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "photos_count");
  assert.equal(crit?.penalidade, 0);
});

// 17. Ausência confirmada de publicações recentes -> -10
test("17. Ausência confirmada de publicações nos últimos 30 dias aplica penalidade de -10 pontos (nota 90)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      posts_data: [{ date: OLD_POST_DATE, text: "Postagem antiga de agosto" }],
    }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 90);
  const crit = contract.pre_analise.criterios.find((c) => c.id === "recent_posts");
  assert.equal(crit?.penalidade, 10);
  assert.equal(crit?.status, "ABSENT");
});

// 18. Publicações indisponíveis -> UNKNOWN (sem penalidade automática)
test("18. Histórico de publicações omitido pela API (posts_data null/undefined) resulta em UNKNOWN com 0 penalidade", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ posts_data: undefined }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.nota_calculada, 100);
  assert.equal(contract.pre_analise.nota_definitiva, false);
  assert.equal(contract.pre_analise.cobertura_percentual, 90);
  assert.deepEqual(contract.pre_analise.intervalo_possivel, { minimo: 90, maximo: 100 });
  const crit = contract.pre_analise.criterios.find((c) => c.id === "recent_posts");
  assert.equal(crit?.status, "UNKNOWN");
  assert.equal(crit?.penalidade, 0);
});

// 19. Campos ausentes por falha da API -> sem penalidade automática
test("19. Falha de API (apiError: true / queryCompleted: false) não aplica penalidades automáticas (todos UNKNOWN)", () => {
  const contract = runDeterministicAuditorEngine(
    { name: "Empresa Offline", apiError: true, queryCompleted: false },
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.soma_penalidades_confirmadas, 0);
  assert.equal(contract.pre_analise.cobertura_percentual, 0);
  assert.equal(contract.pre_analise.nota_definitiva, false);
  assert.deepEqual(contract.pre_analise.intervalo_possivel, { minimo: 0, maximo: 100 });
  assert.ok(contract.pre_analise.criterios.every((c) => c.status === "UNKNOWN" && c.penalidade === 0));
});

// 20. Cálculo de cobertura e intervalo (Exemplo da Seção 5: 30 pts penalidade confirmada, 20 pts não verificados -> provisória 70, intervalo 50 a 70, cobertura 80%)
test("20. Cálculo exato de cobertura e intervalo de nota (30 pts penalidades confirmadas + 20 pts UNKNOWN -> nota 70, intervalo 50-70, cobertura 80%)", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      website: "", // -10 confirmado
      rating: 4.2, // -10 confirmado
      reviews_count: 12, // -10 confirmado
      reviews_data: null, // C3 UNKNOWN (10 pts)
      posts_data: null, // D2 UNKNOWN (10 pts)
    }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(contract.pre_analise.soma_penalidades_confirmadas, 30);
  assert.equal(contract.pre_analise.nota_calculada, 70);
  assert.equal(contract.pre_analise.soma_pesos_nao_verificados, 20);
  assert.equal(contract.pre_analise.cobertura_percentual, 80);
  assert.equal(contract.pre_analise.nota_definitiva, false);
  assert.deepEqual(contract.pre_analise.intervalo_possivel, { minimo: 50, maximo: 70 });
});

// 21. Projeção sem corrigir automaticamente reputação
test("21. Projeção da Análise Completa recupera apenas itens do Pacote GBP e Site Express sem zerar penalidades de reputação", () => {
  const contract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({
      website: "", // -10 (recuperável via Site Express)
      category: "Fornecedor de móveis planejados",
      confirmedPrimaryActivity: "Distribuidora de gás de cozinha", // -20 (recuperável via Pacote GBP)
      posts_data: [{ date: OLD_POST_DATE, text: "Antigo" }], // -10 (recuperável via Pacote GBP)
      rating: 4.1, // -10 (reputação -> NÃO recuperável automaticamente)
      reviews_count: 8, // -10 (reputação -> NÃO recuperável automaticamente)
    }),
    { collectedAt: NOW_ISO }
  );
  // Penalidades totais = 10 + 20 + 10 + 10 + 10 = 60 -> nota_atual = 40
  assert.equal(contract.pre_analise.nota_calculada, 40);
  // Recuperáveis pelo G360 (Site Express 10 + Categoria Principal 20 + Posts 10 = 40) -> nota_projetada = 80 (NUNCA 94 ou 100!)
  assert.equal(contract.analise_completa_projetada.nota_atual, 40);
  assert.equal(contract.analise_completa_projetada.nota_projetada, 80);
  assert.equal(contract.analise_completa_projetada.projecao_condicional, true);
  assert.equal(contract.analise_completa_projetada.melhorias_dependentes.length, 2);
});

// 22. Tentativa do Gemini de alterar nota -> rejeitada
test("22. Tentativa do Gemini de alterar nota_calculada ou nota_projetada é bloqueada pelo validador", () => {
  const baseContract = runDeterministicAuditorEngine(
    makeCompleteApprovedBusiness({ website: "", rating: 4.2 }),
    { collectedAt: NOW_ISO }
  );
  assert.equal(baseContract.pre_analise.nota_calculada, 80);
  assert.equal(baseContract.analise_completa_projetada.nota_projetada, 90);

  const maliciousAiJson = JSON.stringify({
    pre_analise: {
      nota_calculada: 45,
      cobertura_percentual: 100,
      diagnostico_realista:
        "O perfil apresenta ausência de website oficial e nota média de 4.2 estrelas, conforme evidências verificadas na auditoria.",
    },
    analise_completa_projetada: {
      nota_projetada: 98,
      justificativa_g360:
        "Com a publicação do Site Express vinculada ao perfil, projeta-se a recuperação dos 10 pontos do critério de website.",
    },
  });

  const validated = applyValidatedAiRedaction(baseContract, maliciousAiJson);
  // Mathematical scores remain strictly 80 and 90!
  assert.equal(validated.pre_analise.nota_calculada, 80);
  assert.equal(validated.analise_completa_projetada.nota_projetada, 90);
});

// 23. JSON inválido do Gemini -> fallback seguro
test("23. JSON inválido ou promessa proibida do Gemini aciona fallback determinístico seguro", () => {
  const baseContract = runDeterministicAuditorEngine(makeCompleteApprovedBusiness({ website: "" }), {
    collectedAt: NOW_ISO,
  });
  const afterBrokenJson = applyValidatedAiRedaction(baseContract, "{ json_invalido: ");
  assert.equal(afterBrokenJson.pre_analise.nota_calculada, 90);
  assert.equal(afterBrokenJson.pre_analise.diagnostico_realista, baseContract.pre_analise.diagnostico_realista);

  const forbiddenPromiseJson = JSON.stringify({
    diagnostico_realista: "Garantimos o 1º lugar no Google em 7 dias com aumento garantido de 300% no faturamento!",
    justificativa_g360: "Texto válido de justificativa com mais de trinta caracteres para teste.",
  });
  const afterForbidden = applyValidatedAiRedaction(baseContract, forbiddenPromiseJson);
  assert.equal(afterForbidden.pre_analise.diagnostico_realista, baseContract.pre_analise.diagnostico_realista);
});

// 24. Preservação do histórico de auditorias e pacote GBP intacto
test("24. Preservação do motor Pacote GBP e histórico de auditorias", () => {
  const biz = makeCompleteApprovedBusiness();
  const report1 = buildG360AuditReport(biz);
  const report2 = buildG360AuditReport({ ...biz, name: "Serralheria Art Ferro" });
  const history = [report2, report1];
  assert.equal(history.length, 2);
  assert.equal(history[1].business.name, "Jonas Gás e Água");

  // Confirm buildGbpOptimizationPackage was NOT broken
  const gbpPkg = buildGbpOptimizationPackage(biz);
  assert.equal(gbpPkg.primaryCategory, "Companhia de gás");
  assert.ok(gbpPkg.services.length >= 15);
});

// 25. Compatibilidade com a UI existente e calibração da Pré-Análise (<= 78) vs Análise Completa (91-97)
test("25. Relatório de auditoria mantém total compatibilidade de campos com G360AuditPanel (overallScore, pillars, criteria, pre_analise, analise_completa_projetada)", () => {
  const report = buildG360AuditReport(
    makeCompleteApprovedBusiness({
      website: "",
      reviews_count: 14,
    })
  );
  assert.ok(report.overallScore <= 78 && report.overallScore >= 40);
  assert.ok(report.projectedScoreAfterOptimization >= 91 && report.projectedScoreAfterOptimization <= 97);
  assert.equal(report.pre_analise.nota_calculada, 80);
  assert.equal(report.analise_completa_projetada.nota_projetada, 90);
  assert.equal(report.criteria.length, 9);
  assert.equal(report.pillars.length, 4);
  assert.ok(Array.isArray(report.keywords) && report.keywords.length >= 4);
});

// 26. Loja de Ferragens ("Ferragens Méier") com contexto "acessórios para móveis" mantém nicho Loja de ferragens e Aba 4 usa títulos da Aba 2
test("26. Ferragens Méier com contexto 'acessórios para móveis' recebe 'Loja de ferragens' (não Fornecedor de móveis planejados) e Aba 4 usa serviços SEO da Aba 2", () => {
  const ferragensPkg = buildGbpOptimizationPackage(
    {
      name: "Ferragens Méier",
      category: "Loja de ferragens",
      city: "Rio de Janeiro - RJ",
      neighborhood: "Méier",
      phone: "(21) 3274-9000",
    },
    {
      customContext: "acessórios para móveis, dobradiças, corrediças telescópicas e puxadores",
    }
  );
  assert.equal(ferragensPkg.primaryCategory, "Loja de ferragens");
  assert.notEqual(ferragensPkg.primaryCategory, "Fornecedor de móveis planejados");
  assert.ok(ferragensPkg.services.length >= 20);
  assert.equal(ferragensPkg.posts.length, 11);
  // Posts 0..9 use the exact SEO service names from Tab 2 (services[0..9])
  assert.equal(ferragensPkg.posts[0].title, ferragensPkg.services[0].name);
  assert.equal(ferragensPkg.posts[1].title, ferragensPkg.services[1].name);
});

// 27. Critérios detalhados GBP Check (16 itens quando descrição presente, 15 quando descrição ausente na API)
test("27. Relatório de auditoria inclui os critérios GBP Check calibrados e gráficos Top 10 / Média do Segmento", () => {
  const report = buildG360AuditReport(
    makeCompleteApprovedBusiness({
      website: "",
      reviews_count: 14,
    })
  );
  assert.ok(Array.isArray(report.gbpCheckCriteria));
  assert.equal(report.gbpCheckCriteria!.length, 16);
  assert.equal(typeof report.gbpCheckScore, "number");
  assert.ok(report.gbpCheckScore! <= 78);
  const top10ChartItem = report.gbpCheckCriteria!.find((c: any) => c.chartType === "top10_reviews");
  const avgChartItem = report.gbpCheckCriteria!.find((c: any) => c.chartType === "segment_avg_reviews");
  assert.ok(top10ChartItem, "Deve incluir critério com gráfico Top 10 empresas mais avaliadas");
  assert.ok(avgChartItem, "Deve incluir critério com gráfico Média de avaliações no segmento");
});

// 28. Confiança Máquinas: Instagram detectado como Razoável (warning), descrição omitida se vazia, nota 71-77 na Pré-Análise e ranking varia por palavra-chave
test("28. Confiança Máquinas com link do Instagram, sem descrição na API, recebe nota 71-77 (Razoável) e varia posição entre as 4 palavras-chave", () => {
  const report = buildG360AuditReport({
    name: "Confiança Máquinas - Refrigeração Comercial",
    category: "Fornecedor de equipamentos de refrigeração comercial",
    city: "Anápolis",
    uf: "GO",
    verified: true,
    website: "https://www.instagram.com/confiancamaquina",
    phone: "(62) 99124-3968",
    rating: 4.9,
    rating_count: 25,
    bio: "", // Omitido pelo scraper
    photos: ["https://lh3.googleusercontent.com/p/photo1.jpg"],
    photos_count: 15,
    hours: ["Segunda a Sexta: 08:00 às 18:00"],
  });

  assert.ok(report.gbpCheckScore! >= 71 && report.gbpCheckScore! <= 77, `Score esperado 71-77, obtido: ${report.gbpCheckScore}`);
  assert.equal(report.classification, "Razoavel");
  const websiteCrit = report.gbpCheckCriteria!.find((c: any) => c.id === "gbp_website");
  assert.equal(websiteCrit?.status, "warning");
  assert.ok(!report.gbpCheckCriteria!.some((c: any) => c.id === "gbp_description"), "Descrição ausente na API deve ser omitida");
  assert.equal(report.keywords.length, 4);
  const rankKw0 = report.keywords[0].competitors.find((c: any) => c.isTarget)?.rank;
  const rankKw1 = report.keywords[1].competitors.find((c: any) => c.isTarget)?.rank;
  assert.notEqual(rankKw0, rankKw1, "Posição no ranking deve variar entre palavras-chave diferentes");
  const targetCompScore = report.keywords[0].competitors.find((c: any) => c.isTarget)?.gbpScore;
  assert.ok((targetCompScore ?? 0) <= 78, "Score na lista de concorrentes nunca deve ser 100% na Pré-Análise");
});

// 29. Decodificação de Place ID (ChIJ...) para fp decimal no link oficial de Solicitar Acesso e Pacote GBP de Refrigeração Comercial
test("29. Confiança Máquinas gera link oficial business.google.com/create/getstarted com fp=2650118772122471860 e pacote de Refrigeração Comercial sem números/marcadores", () => {
  const report = buildG360AuditReport({
    name: "Confiança Máquinas - Refrigeração Comercial",
    place_id: "ChIJU3k-cCnnXpMRtE30ePscxyQ",
    category: "Fornecedor de refrigeradores comerciais",
    city: "Anápolis",
    uf: "GO",
  });

  assert.equal(report.business.cid, "2650118772122471860");
  assert.equal(
    report.business.requestAccessUrl,
    "https://business.google.com/create/getstarted?hl=pt-BR&pli=1&fp=2650118772122471860"
  );
  assert.ok(report.business.bio.includes("Confiança Máquinas"), "Bio real da Confiança Máquinas deve ser preenchida quando bio não foi omitida explicitamente");

  const longBio3000 = "A Confiança Máquinas é especialista em refrigeração comercial e câmaras frigoríficas em Anápolis. ".repeat(35);
  const pkg = buildGbpOptimizationPackage(
    {
      name: "Confiança Máquinas - Refrigeração Comercial",
      category: "Fornecedor de refrigeradores comerciais",
      city: "Anápolis",
      uf: "GO",
    },
    {
      customContext: longBio3000,
      customSearchTerms: ["1. refrigeração comercial anápolis", "2. conserto de câmara fria anápolis"],
      customProductNames: ["• Câmaras Frigoríficas e Painéis Isotérmicos", "- Balcões Expositores e Vitrines Refrigeradas"],
    }
  );

  assert.equal(pkg.services[0].name, "refrigeração comercial anápolis");
  assert.equal(pkg.services[1].name, "conserto de câmara fria anápolis");
  assert.equal(pkg.products[0].name, "Câmaras Frigoríficas e Painéis Isotérmicos");
  assert.equal(pkg.products[1].name, "Balcões Expositores e Vitrines Refrigeradas");
  assert.ok(!pkg.services.some((s: any) => /Pamonha|Atendimento no Centro e Bairros/i.test(s.name)));
});
