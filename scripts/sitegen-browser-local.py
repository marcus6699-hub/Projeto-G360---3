#!/usr/bin/env python3
"""Chromium sampling of generated HTML against fictional payloads, offline only."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
directory = Path(tempfile.mkdtemp(prefix='g360-sitegen-browser-'))
env = {k: os.environ[k] for k in ['PATH', 'LANG'] if k in os.environ}
subprocess.run(['node', '--import', 'tsx', 'scripts/sitegen-browser-fixtures.mjs', str(directory)], cwd=root, env=env, check=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(directory)))
threading.Thread(target=server.serve_forever, daemon=True).start()
port = server.server_port
results = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        for case in json.loads((directory / 'manifest.json').read_text()):
            context = browser.new_context()
            blocked = []
            def route(r):
                target = urlparse(r.request.url)
                if case['name'] == 'gtm-controlled-container' and target.hostname == 'www.googletagmanager.com' and target.path == '/gtm.js':
                    r.fulfill(status=200, content_type='application/javascript', body="try{parent.document.body.dataset.gtmCompromised='yes';window.__gtmIsolated=false}catch(e){window.__gtmIsolated=true}")
                elif target.scheme in {'about', 'data', 'blob'} or (target.hostname == '127.0.0.1' and target.port == port): r.continue_()
                else:
                    blocked.append(target.hostname or target.scheme)
                    r.abort()
            context.route('**/*', route)
            page = context.new_page()
            page.goto(f'http://127.0.0.1:{port}/{case["name"]}-frame.html', wait_until='networkidle')
            frame = page.frame_locator('#generated')
            generated = page.frames[1]
            page.wait_for_timeout(150)
            before = generated.evaluate('window.__g360Marker || null')
            anchors = generated.locator('a').evaluate_all("elements => elements.map(a=>({href:a.getAttribute('href'),target:a.getAttribute('target')})).filter(a=>/^\\s*(javascript|data|vbscript):/i.test(a.href||''))")
            for anchor in generated.locator('a').all():
                href = anchor.get_attribute('href') or ''
                if href.startswith('javascript:'):
                    try: anchor.evaluate('(a)=>a.click()')
                    except Exception: pass
            page.wait_for_timeout(100)
            after = generated.evaluate('window.__g360Marker || null')
            result = {'name': case['name'], 'markerBeforeClick': before, 'markerAfterClick': after, 'unsafeAnchors': anchors,
                      'canAccessParentDocument': generated.evaluate('(()=>{try{return !!parent.document}catch(e){return false}})()'),
                      'gtmIsolated': generated.evaluate('window.__gtmIsolated ?? null'), 'blockedExternalHosts': sorted(set(blocked))}
            results.append(result)
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
    report = {'directory': str(directory), 'results': results, 'limitations': 'Sampling of generated HTML only; no real users, services, production data or universal XSS conclusion.'}
    (directory / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))
if any(row['markerBeforeClick'] or row['markerAfterClick'] or row['unsafeAnchors'] or row['canAccessParentDocument'] or (row['name'] == 'gtm-controlled-container' and row['gtmIsolated'] is not True) for row in results):
    raise SystemExit(2)
