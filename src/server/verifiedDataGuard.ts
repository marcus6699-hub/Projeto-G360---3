import type { Request, Response, NextFunction } from "express";

// A local call counter cannot prove that an account has free quota remaining or
// prevent a provider from billing another project using the same credentials.
// Keep these routes closed until both billing protection AND an evidence-only
// report (with source and unknown values) are implemented and tested.
export function verifiedDataUnavailable(_req: Request, res: Response, _next: NextFunction): void {
  res.status(503).json({
    ok: false,
    code: "VERIFIED_DATA_UNAVAILABLE",
    error: "Dados verificáveis indisponíveis: saldo/cota gratuita e proteção contra cobrança não confirmados. Nenhuma consulta foi executada; não há resultados de demonstração nesta busca.",
  });
}
