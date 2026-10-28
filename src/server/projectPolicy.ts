import { createHash } from 'node:crypto';
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function validProjectMutation(value: unknown): value is Record<string, any> {
  if (!object(value)) return false;
  if (value.name !== undefined && !text(value.name, 200)) return false;
  if (value.archetype !== undefined && !text(value.archetype, 80)) return false;
  if (value.status !== undefined && !['active', 'draft', 'published', 'suspended'].includes(value.status)) return false;
  if (value.data !== undefined) {
    if (!object(value.data)) return false;
    if (value.data.business !== undefined && !object(value.data.business)) return false;
    if (value.data.business?.name !== undefined && !text(value.data.business.name, 200)) return false;
    if (value.data.archetype !== undefined && !text(value.data.archetype, 80)) return false;
  }
  return true;
}
export const projectEtag = (project: unknown) => `"${createHash('sha256').update(JSON.stringify(project)).digest('hex')}"`;
