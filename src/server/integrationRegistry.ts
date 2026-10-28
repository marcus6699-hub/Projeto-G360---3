import type { Express } from 'express';
import { requireAdmin } from '../middleware/auth.ts';
import { externalAccess, type ExternalProvider } from './externalAccess.ts';

/** Credential values are never serialized. Presence does not prove validity or free credit. */
const providers: Record<string, string[]> = {
  gemini: ['GEMINI_API_KEY'], google_places: ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'],
  outscraper: ['OUTSCRAPER_API_KEY'], groq: ['GROQ_API_KEY'], openrouter: ['OPENROUTER_API_KEY'], nvidia: ['NVIDIA_API_KEY'],
  cerebras: ['CEREBRAS_API_KEY'], mistral: ['MISTRAL_API_KEY'], huggingface: ['HUGGINGFACE_API_KEY'], serper: ['SERPER_API_KEY'],
  vercel: ['VERCEL_TOKEN'], netlify: ['NETLIFY_TOKEN'],
};
export function integrationStatus(env: NodeJS.ProcessEnv) {
  return Object.entries(providers).map(([id, variables]) => ({
    id, configured: variables.some(key => Boolean(env[key]?.trim()) && !env[key]?.startsWith('MY_')),
    verification: 'not_verified', creditType: 'unknown', balance: null, paidUseAuthorized: false,
    replacement: 'server_environment_requires_restart',
    authorization: ['vercel', 'netlify'].includes(id) ? 'not_covered_by_provider_policy' : externalAccess.allowed(id as ExternalProvider) ? 'explicit_free_grant' : 'blocked_without_valid_grant',
  }));
}
export function publicDeploySettings(settings: any) {
  return {
    agencyName: settings?.agencyName || '', agencyPhone: settings?.agencyPhone || '', agencyDocument: settings?.agencyDocument || '',
    vercelConfigured: Boolean(settings?.vercelToken || process.env.VERCEL_TOKEN),
    netlifyConfigured: Boolean(settings?.netlifyToken || process.env.NETLIFY_TOKEN),
  };
}
export function registerIntegrationRoutes(app: Express) {
  app.get('/api/admin/integrations', requireAdmin, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ integrations: integrationStatus(process.env), secretsReturned: false, billingVerification: 'required_before_external_use' });
  });
}
