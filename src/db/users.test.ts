import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './index.ts';
import { users, audits } from './schema.ts';
import { upsertUserAudit, SqlOwnershipConflict } from './users.ts';

const payload = { auditId: 'fixture-audit', businessName: 'Fictitious', city: 'Fixture', overallScore: 50, classification: 'fixture', verified: false };

test('SQL audit upsert includes server-controlled owner filter at conflict, preserves owner, returns own row', async t => {
  const insert = db.insert.bind(db);
  let query: any;
  t.mock.method(db, 'insert', (table: any) => {
    // Use the real Drizzle query builder; replace only database execution.
    const values = (values: any) => {
      const real = insert(table).values(values);
      const conflict = real.onConflictDoUpdate.bind(real);
      real.onConflictDoUpdate = ((configuration: any) => {
        const built = conflict(configuration);
        built.returning = (() => {
          query = built.toSQL();
          return Promise.resolve(table === users ? [{ id: 7 }] : [{ id: 9, userId: 7, auditId: payload.auditId }]);
        }) as any;
        return built;
      }) as any;
      return real;
    };
    return { values } as any;
  });
  const result = await upsertUserAudit('fixture-user', 'fixture@example.invalid', payload);
  assert.equal(result.userId, 7);
  assert.match(query.sql, /where "audits"\."user_id" = \$\d+$/i);
  assert.equal(query.params.at(-1), 7);
  assert.doesNotMatch(query.sql.split('do update set')[1].split('where')[0], /"user_id"\s*=/);
});

test('cross-account conflict returns explicit conflict rather than success without persisted row', async t => {
  t.mock.method(db, 'insert', (table: any) => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => table === users ? [{ id: 8 }] : [] }) }) }) as any);
  await assert.rejects(upsertUserAudit('other-fixture-user', 'other@example.invalid', payload), (error: any) => error instanceof SqlOwnershipConflict && error.status === 409);
});
