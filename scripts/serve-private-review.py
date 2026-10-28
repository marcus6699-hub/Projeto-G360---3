#!/usr/bin/env python3
"""Loopback-only review server. Requires explicitly fictional config and data."""
from pathlib import Path
import os,json,subprocess
root=Path(__file__).resolve().parent.parent
data=Path('/workspace/g360-homologacao-etapa5-data')
if (root/'.env').exists():raise SystemExit('Refusing review server with a .env file present.')
assert json.loads((root/'firebase-applet-config.json').read_text())['projectId'].startswith('demo-')
assert all(c.get('fictional') is True and c['email'].endswith('@example.invalid') for c in json.loads((data/'TEST-CREDENTIALS-PRIVATE.json').read_text()))
preload=data/'deny-external-review.mjs'
preload.write_text("globalThis.fetch=async()=>{throw Error('External fetch disabled in private fictional review')};\n")
preload.chmod(0o600)
env={k:os.environ[k] for k in ['PATH','LANG','NODE_EXTRA_CA_CERTS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'] if k in os.environ}
env.update(HOME=str(data),NODE_ENV='development',BIND_HOST='127.0.0.1',PORT='3001',G360_DATA_DIR=str(data),G360_ALLOWED_ORIGINS='http://127.0.0.1:3001')
print('Private fictional review: http://127.0.0.1:3001 ; no port published',flush=True)
process=subprocess.Popen(['node','--import',str(preload),'--import','tsx','server.ts'],cwd=root,env=env)
try:raise SystemExit(process.wait())
except KeyboardInterrupt:
 process.terminate();process.wait()
