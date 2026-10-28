import test from 'node:test';
import assert from 'node:assert/strict';
import { logoutEverywhere, LogoutIncompleteError } from './logoutCoordinator.ts';

test('coordinated logout ends both authorities and clears account state', async () => {
  const calls: string[] = [];
  const result = await logoutEverywhere({ endBackendSession: async () => { calls.push('backend'); }, signOutFirebase: async () => { calls.push('firebase'); }, clearLocalState: () => { calls.push('clear'); } });
  assert.deepEqual(calls, ['backend', 'firebase', 'clear']);
  assert.deepEqual(result, { backendEnded: true, firebaseEnded: true, localStateCleared: true });
});
test('backend failure still signs out Firebase and clears UI, without pretending full success', async () => {
  let signedOut = false, cleared = false;
  await assert.rejects(logoutEverywhere({ endBackendSession: async () => { throw Error('fictional-sensitive-error'); }, signOutFirebase: async () => { signedOut = true; }, clearLocalState: () => { cleared = true; } }), error => {
    assert.ok(error instanceof LogoutIncompleteError); assert.equal(error.result.backendEnded, false);
    assert.equal(error.message.includes('fictional-sensitive-error'), false); return true;
  });
  assert.equal(signedOut, true); assert.equal(cleared, true);
});
test('synchronous Firebase failure does not skip backend logout or conceal incomplete logout', async () => {
  let backend = false, cleared = false;
  await assert.rejects(logoutEverywhere({ endBackendSession: async () => { backend = true; }, signOutFirebase: () => { throw Error('fictional-provider-error'); }, clearLocalState: () => { cleared = true; } }), (error: any) => error instanceof LogoutIncompleteError && error.result.backendEnded && !error.result.firebaseEnded);
  assert.equal(backend, true); assert.equal(cleared, true);
});
test('failed local cleanup is reported even when both sessions ended', async () => {
  await assert.rejects(logoutEverywhere({ endBackendSession: async () => {}, signOutFirebase: async () => {}, clearLocalState: () => { throw Error('Fictional clear failure'); } }), (error: any) => error instanceof LogoutIncompleteError && !error.result.localStateCleared);
});
