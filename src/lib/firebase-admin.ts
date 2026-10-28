import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (process.env.NODE_ENV === 'production' && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) {
  throw new Error('[Startup] Emulator configuration is not permitted in production');
}

const projectId = firebaseConfig?.projectId;
if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
  throw new Error('[Startup] Firebase project configuration is invalid');
}

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

export const adminAuth = getAuth();
