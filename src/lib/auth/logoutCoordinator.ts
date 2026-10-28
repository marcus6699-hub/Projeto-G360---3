export type LogoutResult = { backendEnded: boolean; firebaseEnded: boolean; localStateCleared: boolean };
export class LogoutIncompleteError extends Error {
  constructor(public result: LogoutResult) {
    super('Saída incompleta. Mantenha os dados protegidos ocultos e tente encerrar as sessões novamente.');
  }
}

/** Frontend integration helper: injected operations only, no SDK or credentials here. */
export async function logoutEverywhere(operations: {
  endBackendSession: () => Promise<unknown>;
  signOutFirebase: () => Promise<unknown>;
  clearLocalState: () => void;
}): Promise<LogoutResult> {
  // Both authorities must be attempted even if one throws synchronously or fails.
  const settled = await Promise.allSettled([
    Promise.resolve().then(operations.endBackendSession),
    Promise.resolve().then(operations.signOutFirebase),
  ]);
  const result: LogoutResult = {
    backendEnded: settled[0].status === 'fulfilled',
    firebaseEnded: settled[1].status === 'fulfilled',
    localStateCleared: false,
  };
  try { operations.clearLocalState(); result.localStateCleared = true; } catch { /* Never reveal upstream errors or state contents. */ }
  if (!result.backendEnded || !result.firebaseEnded || !result.localStateCleared) throw new LogoutIncompleteError(result);
  return result;
}
