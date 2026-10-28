// Controlled compatibility experiment: copy into the isolated candidate before running.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import grpc from '@grpc/grpc-js';
import loader from '@grpc/proto-loader';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, terminate } from 'firebase/firestore';
const require = createRequire(import.meta.url);
assert.equal(require('@grpc/grpc-js/package.json').version, '1.14.6', 'Run only inside the isolated candidate with the proposed dependency version');
const protos = path.join(path.dirname(require.resolve('@google-cloud/firestore/package.json')), 'build/protos');
const definition = loader.loadSync(path.join(protos, 'google/firestore/v1/firestore.proto'), { longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [protos] });
const service = grpc.loadPackageDefinition(definition).google.firestore.v1.Firestore.service;
const server = new grpc.Server();
let hits = 0;
server.addService(service, { listen(call) { call.on('data', request => { if (!request.addTarget) return; hits++; assert.equal(request.database, 'projects/demo-g360-dependency/databases/(default)'); const target = request.addTarget.targetId; call.write({ targetChange: { targetChangeType: 'ADD', targetIds: [target] } }); call.write({ documentChange: { document: { name: request.addTarget.documents.documents[0], fields: { source: { stringValue: 'controlled-gRPC-fixture' } }, createTime: { seconds: '1' }, updateTime: { seconds: '1' } }, targetIds: [target] } }); call.write({ targetChange: { targetChangeType: 'CURRENT', targetIds: [target], resumeToken: Buffer.from('fixture') } }); call.write({ targetChange: { targetChangeType: 'NO_CHANGE', targetIds: [], readTime: { seconds: '1' } } }); }); }, batchGetDocuments(call) { hits++; assert.equal(call.request.database, 'projects/demo-g360-dependency/databases/(default)'); call.write({ found: { name: call.request.documents[0], fields: { source: { stringValue: 'controlled-gRPC-fixture' } }, createTime: { seconds: '1' }, updateTime: { seconds: '1' } }, readTime: { seconds: '1' } }); call.end(); } });
const port = await new Promise((resolve, reject) => server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, value) => error ? reject(error) : resolve(value)));
const app = initializeApp({ projectId: 'demo-g360-dependency', apiKey: 'fictional-key', appId: 'fictional-app' });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', port, { mockUserToken: { sub: 'fixture-user', email_verified: true } });
try {
 const record = await Promise.race([getDocFromServer(doc(db, 'fixtures', 'grpc-read')), new Promise((_, reject) => { const timeout = setTimeout(() => reject(Error('controlled RPC timeout')), 8000); timeout.unref(); })]);
 assert.equal(record.exists(), true); assert.equal(record.data().source, 'controlled-gRPC-fixture'); assert.equal(hits, 1);
 console.log('Controlled Firestore Node SDK gRPC read: PASS (one local RPC, no real Firestore, no rules emulator).');
} finally { await terminate(db); await deleteApp(app); server.forceShutdown(); }
