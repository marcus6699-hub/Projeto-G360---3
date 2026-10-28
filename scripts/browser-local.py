#!/usr/bin/env python3
"""Real Chromium check in a disposable fictional app copy; never starts the original DB."""
import hashlib
import argparse
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import tempfile
import time
import threading
import urllib.request
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
arguments = argparse.ArgumentParser()
arguments.add_argument("--verify-patches", action="store_true", help="Apply only the isolated UI review patches inside the temporary copy")
args = arguments.parse_args()
FIXTURE = Path(tempfile.mkdtemp(prefix="g360-browser-"))

def skip(_directory, names):
    return [name for name in names if name in {".git", "node_modules", "dist", "attachments"}
            or name.startswith((".env", "db.json", "cost-guard-metrics.json"))
            or name == "firebase-applet-config.json"]

shutil.copytree(ROOT, FIXTURE, dirs_exist_ok=True, ignore=skip)
if args.verify_patches:
    for patch in ["antigravity-crm-storage-uid.patch", "auth-recovery-no-false-success.patch"]:
        patch_file = str(FIXTURE / "docs/patches" / patch)
        check = subprocess.run(["git", "apply", "--check", patch_file], cwd=FIXTURE, capture_output=True)
        if check.returncode == 0:
            subprocess.run(["git", "apply", patch_file], cwd=FIXTURE, check=True)
        else:
            subprocess.run(["git", "apply", "--reverse", "--check", patch_file], cwd=FIXTURE, check=True)
# Read-only dependency reuse for a temporary source copy, not another Git worktree.
(FIXTURE / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
(FIXTURE / "firebase-applet-config.json").write_text(json.dumps({
    "apiKey": "AIzaFictionalBrowserFixtureNoRealCredential",
    "authDomain": "demo-g360-browser.invalid",
    "projectId": "demo-g360-browser",
    "storageBucket": "demo-g360-browser.invalid",
    "messagingSenderId": "000000000000",
    "appId": "1:000000000000:web:fictional",
    "firestoreDatabaseId": "(default)",
}))
password = "fictional-browser-password"
salt = "fictional-browser-salt"
digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
(FIXTURE / "db.json").write_text(json.dumps({
    "securityPlanFixture": True,
    "users": [{"id": "browser-admin", "name": "Admin Fictício", "email": "browser@example.invalid", "role": "admin", "password": f"scrypt:{salt}:{digest}"}],
    "projects": [], "clicks": {}, "aiSettings": {},
    "g360": {"audits": [], "crmLeads": [], "packagesByBusiness": {}, "financeGoals": {}, "deploySettings": {}},
}))
os.chmod(FIXTURE / "db.json", 0o600)
env = {key: os.environ[key] for key in ["PATH", "LANG", "NODE_EXTRA_CA_CERTS"] if key in os.environ}
env["HOME"] = str(FIXTURE)
# Prevent even optional server-side fetch fallbacks from contacting a remote service.
(FIXTURE / "deny-external.mjs").write_text("globalThis.fetch = async () => { throw Error('External transport disabled in browser fixture'); };\n")

def run(command, **kwargs):
    return subprocess.run(command, cwd=FIXTURE, env=env, check=True, **kwargs)

with (FIXTURE / "build.log").open("w") as log:
    run(["npm", "run", "build"], stdout=log, stderr=log)

with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
backend = f"http://127.0.0.1:{port}"
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    tls_port = sock.getsockname()[1]
base = f"https://127.0.0.1:{tls_port}"
env.update({"NODE_ENV": "production", "BIND_HOST": "127.0.0.1", "PORT": str(port), "G360_ALLOWED_ORIGINS": base})
with (FIXTURE / "certificate.log").open("w") as log:
    run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "fixture.key", "-out", "fixture.crt", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"], stdout=log, stderr=log)
class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass
    def forward(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        upstream = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
        try:
            upstream.request(self.command, self.path, body=body, headers={k: v for k, v in self.headers.items() if k.lower() not in {"connection", "accept-encoding"}})
            response = upstream.getresponse()
            payload = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in {"connection", "transfer-encoding", "content-length"}:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        finally:
            upstream.close()
    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = forward
proxy = ThreadingHTTPServer(("127.0.0.1", tls_port), Proxy)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(FIXTURE / "fixture.crt", FIXTURE / "fixture.key")
proxy.socket = tls.wrap_socket(proxy.socket, server_side=True)
threading.Thread(target=proxy.serve_forever, daemon=True).start()
checks = []
findings = []
errors = []
blocked = []
server_log = (FIXTURE / "server.log").open("w")
process = subprocess.Popen(["node", "--import", "./deny-external.mjs", "--import", "tsx", "server.ts"], cwd=FIXTURE, env=env, stdout=server_log, stderr=server_log)

def passed(name):
    checks.append({"name": name, "status": "passed"})

try:
    for _ in range(150):
        if process.poll() is not None:
            raise RuntimeError("Fictional backend exited; inspect fixture server.log")
        try:
            urllib.request.urlopen(backend, timeout=0.2).close()
            break
        except Exception:
            time.sleep(0.1)
    else:
        raise RuntimeError("Fictional backend did not become ready")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True, ignore_https_errors=True)
        def route(request_route):
            url = request_route.request.url
            target = urlparse(url)
            if target.scheme in {"blob", "data", "about"} or (target.hostname == "127.0.0.1" and target.port == tls_port):
                request_route.continue_()
            else:
                blocked.append(target.hostname or target.scheme)
                request_route.abort()
        context.route("**/*", route)
        context.add_init_script("""try { if (!localStorage.getItem('g360_contract_provider')) localStorage.setItem('g360_contract_provider', JSON.stringify({name:'Prestador Fictício',cpf:'000.000.000-00',rg:'0000000',address:'Rua Fictícia, 0'})); } catch {}""")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)[:400]))
        page.goto(base, wait_until="networkidle")
        expect(page.get_by_test_id("auth-page")).to_be_visible()
        assert page.url.endswith("/login")
        assert context.request.get(base + "/api/projects").status == 401
        passed("Anonymous browser redirects to login and protected API denies access")

        page.get_by_test_id("auth-email-input").fill("browser@example.invalid")
        page.get_by_test_id("auth-password-input").fill("incorrect-fictional-password")
        page.get_by_test_id("auth-submit-button").click()
        expect(page.get_by_text("Credenciais inválidas.")).to_be_visible()
        expect(page.get_by_test_id("auth-page")).to_be_visible()
        passed("Incorrect password is refused in the real login UI")

        page.get_by_test_id("auth-password-input").fill(password)
        page.get_by_test_id("auth-submit-button").click()
        expect(page.get_by_test_id("studio-root")).to_be_visible(timeout=15000)
        identity = context.request.get(base + "/api/auth/me")
        assert identity.status == 200 and identity.json()["id"] == "browser-admin"
        cookies = context.cookies(base)
        session = next(cookie for cookie in cookies if cookie["name"] == "sxp_uid")
        assert session["httpOnly"] and session["sameSite"] == "Strict" and session["secure"]
        passed("Local login UI creates a validated HttpOnly Strict session")

        page.reload(wait_until="networkidle")
        expect(page.get_by_test_id("studio-root")).to_be_visible()
        passed("Reload preserves the validated local session")
        page.screenshot(path=str(FIXTURE / "logged-in.png"))

        # Separate browser-context API check: no claim that a new Office UI exists.
        assert context.request.get(base + "/api/office").status == 200
        assert context.request.get(base + "/db.json").status == 404
        assert context.request.get(base + "/db.json.g360-previous.json").status == 404
        passed("Authenticated browser-context Office API works; private files remain inaccessible")

        # Integrated navigation and responsive Office on real browser, no external service.
        page.get_by_test_id("nav-g360-office").click()
        expect(page.get_by_role("heading", name="Escritório G360")).to_be_visible()
        for width, height, label in [(1440,1000,"desktop"),(820,1180,"tablet"),(390,844,"mobile")]:
            page.set_viewport_size({"width":width,"height":height})
            page.wait_for_timeout(100)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2")
            page.screenshot(path=str(FIXTURE / ("office-" + label + ".png")), full_page=True)
        passed("Office real UI renders on desktop/tablet/mobile without horizontal overflow")
        page.set_viewport_size({"width":1440,"height":1000})
        page.get_by_test_id("nav-g360-audit").click()
        expect(page.get_by_role("heading", name="Prospecção com fonte verificável")).to_be_visible()
        page.get_by_label("Cidade (referência informada)").fill("Cidade Fictícia")
        page.get_by_label("Latitude do centro").fill("-16")
        page.get_by_label("Longitude do centro").fill("-48")
        page.get_by_role("button",name="Pesquisar registros OSM").click()
        expect(page.get_by_role("status").filter(has_text="indisponível")).to_be_visible()
        passed("Unconfigured prospecting shows unavailable in the real UI")
        # Controlled source fixture; no real OSM/Google request or real company data.
        companies=[{"place_id":"osm:node:424242","name":"Empresa Fictícia A","category":"padaria","city":"Cidade Fictícia","uf":"GO","lat":-16,"lng":-48,"sourceUrl":"https://www.openstreetmap.org/node/424242","rating":None,"rating_count":None}]
        context.route("**/api/g360/osm/discover",lambda r:r.fulfill(status=200,json={"ok":True,"places":companies,"collectedAt":"2026-10-28T12:00:00Z","attribution":"FIXTURE CONTROLADA","limitations":"Dados fictícios para teste"}))
        page.get_by_role("button",name="Pesquisar registros OSM").click()
        page.get_by_role("listitem").filter(has_text="Empresa Fictícia A").get_by_role("button",name="Selecionar").click()
        page.get_by_role("button",name="Prévia geométrica opcional").click()
        expect(page.get_by_text("Geogrid: somente coordenadas")).to_be_visible()
        page.get_by_role("button",name="Registrar análise com data").click()
        expect(page.get_by_text("Pontuação indisponível",exact=True)).to_be_visible()
        passed("Controlled prospect imported; real backend saves evidence and renders unscored Geogrid")
        page.get_by_test_id("nav-g360-package").click()
        expect(page.locator('input[value="Empresa Fictícia A"]').first).to_be_visible()
        page.get_by_test_id("gbp-step-btn-identity_approval").click()
        page.get_by_role("button",name="Clique para Aprovar Identidade").click()
        page.get_by_test_id("gbp-step-btn-review").click()
        page.get_by_role("button",name="Aprovar Item",exact=True).first.click()
        page.get_by_test_id("gbp-step-btn-package_approval").click()
        page.get_by_role("button",name="Aprovar Pacote Completo").click()
        page.get_by_test_id("gbp-step-btn-export_site").click()
        page.get_by_test_id("transfer-to-site-express-btn").click()
        passed("GBP human approval transfers controlled company to Site Express")
        expect(page.get_by_test_id("site-express-direct-panel")).to_be_visible()
        page.get_by_test_id("site-express-direct-generate-btn").click()
        expect(page.get_by_test_id("editor-canvas")).to_be_visible()
        editor_frame=page.get_by_test_id("editor-canvas").content_frame
        editable=editor_frame.locator("[data-edit]").first
        edit_key=editable.get_attribute("data-edit")
        editable.fill("Texto Fictício Revisado")
        editable.press("Tab")
        page.wait_for_timeout(600)
        page.get_by_test_id("editor-save-button").click()
        page.wait_for_timeout(800)
        projects_now=context.request.get(base+"/api/projects").json()["projects"]
        assert any(p.get("data",{}).get("texts",{}).get(edit_key)=="Texto Fictício Revisado" for p in projects_now)
        with page.expect_download() as html_download:
            page.get_by_test_id("export-html-button").click()
        html=Path(html_download.value.path()).read_text()
        assert "Texto Fictício Revisado" in html and "[PENDENTE]" not in html
        with page.expect_download() as zip_download:
            page.get_by_test_id("export-zip-button").click()
        import zipfile
        with zipfile.ZipFile(zip_download.value.path()) as exported:
            assert exported.testzip() is None
            assert any(n.endswith(".html") for n in exported.namelist())
        passed("Real editor inline change persists and HTML/ZIP downloads contain approved fictional content")



        # A fictional project is created through the existing API and then listed by the real UI.
        project = context.request.post(base + "/api/projects", data={"name": "Projeto Fictício Navegador", "archetype": "servicos", "data": {"business": {"name": "Empresa Fictícia"}}})
        assert project.status == 200
        project_id = project.json()["id"]
        assert any(p["id"] == project_id for p in context.request.get(base + "/api/projects").json()["projects"])
        passed("Fictional project creation/listing works through browser-context HTTP")
        public_page = context.new_page()
        public_page.goto(base + '/site/' + project.json()['slug'], wait_until='networkidle')
        expect(public_page.get_by_test_id('public-site-frame')).to_be_visible()
        public_frame = public_page.get_by_test_id('public-site-frame').content_frame
        expect(public_frame.get_by_text('Empresa Fictícia', exact=True).first).to_be_visible()
        isolated = public_page.frames[1].evaluate('(()=>{try{return !!parent.document}catch(e){return false}})()')
        assert isolated is False
        passed('PublicSite mounted iframe renders the fictional company and cannot read parent document')
        public_page.close()
        page.reload(wait_until="networkidle")
        expect(page.get_by_test_id("studio-root")).to_be_visible()

        page.get_by_test_id("nav-g360-crm").click()
        page.get_by_test_id("crm-tab-contract").click()
        expect(page.get_by_text("Status: Minuta de Contrato (Aguardando Assinatura)")).to_be_visible()
        expect(page.get_by_text("Assinatura Externa Pendente", exact=True)).to_be_visible()
        if args.verify_patches:
            assert page.get_by_text("Prestador Fictício", exact=True).count() == 0
            passed("Scoped patch does not auto-assign unowned legacy provider storage")

        def fill_by_label(label, value):
            page.locator("label").filter(has_text=re.compile("^" + re.escape(label) + "$", re.I)).locator("..").locator("input").fill(value)
        for label, value in [
            ("Nome da Empresa / Cliente", "Cliente Fictício Navegador"),
            ("Responsável Legal", "Pessoa Fictícia"),
            ("WhatsApp do Cliente", "00000000000"),
            ("Endereço do Cliente", "Rua Fictícia, 0"),
            ("Condições de Pagamento", "Somente teste; nenhuma cobrança autorizada"),
        ]:
            fill_by_label(label, value)
        page.get_by_placeholder("00.000.000/0001-00").fill("00.000.000/0000-00")
        page.get_by_role("button", name="Editar meus dados").click()
        fill_by_label("Nome Completo", "Prestador Privado Fictício Conta A")
        page.get_by_role("button", name="Recolher", exact=True).click()
        page.get_by_role("button", name="Minuta Pronta — Aguardando Assinatura Externa").click()
        expect(page.get_by_text("Assinatura eletrônica ainda não configurada", exact=False).last).to_be_visible()
        passed("Active contract UI keeps draft/pending signature after its internal button")

        with page.expect_download() as download_info:
            page.get_by_test_id("download-contract-pdf-btn").click()
        download = download_info.value
        target = FIXTURE / "fictional-draft.html"
        download.save_as(target)
        document = target.read_text()
        assert download.suggested_filename.endswith(".html")
        assert "Cliente Fictício Navegador" in document and "Aguardando assinatura das partes" in document
        passed("Actual browser downloads an HTML draft marked awaiting signatures, not a signed PDF")
        page.screenshot(path=str(FIXTURE / "contract-draft.png"), full_page=True)
        page.reload(wait_until="networkidle")
        page.get_by_test_id("nav-g360-crm").click()
        page.get_by_test_id("crm-tab-contract").click()
        expect(page.get_by_text("Prestador Privado Fictício Conta A", exact=True).first).to_be_visible()
        passed("Same-account provider data remains available after reload")

        # Verify the created project is listed after switching to the existing standalone UI.
        page.get_by_test_id("user-menu-button").click()
        page.get_by_role("menuitem", name="Alternar p/ Site Express Separado").click()
        page.get_by_test_id("nav-clients").click()
        expect(page.get_by_text("Projeto Fictício Navegador", exact=True)).to_be_visible()
        passed("Existing project/clients UI displays the fictional persisted project")

        page.get_by_test_id("user-menu-button").click()
        page.get_by_test_id("logout-button").click()
        expect(page.get_by_test_id("auth-page")).to_be_visible(timeout=15000)
        assert context.request.get(base + "/api/auth/me").status == 401
        assert context.request.get(base + "/api/projects").status == 401
        page.reload(wait_until="networkidle")
        expect(page.get_by_test_id("auth-page")).to_be_visible()
        page.goto(base, wait_until="networkidle")
        expect(page.get_by_test_id("auth-page")).to_be_visible()
        passed("Logout revokes backend access and stays denied after reload/navigation")

        # Diagnostic assertions deliberately record existing UI failures without changing the UI.
        page.get_by_test_id("auth-email-input").fill("browser@example.invalid")
        with page.expect_response(lambda response: response.url.endswith("/api/auth/forgot-password")) as recovery_response:
            page.get_by_test_id("auth-forgot-link").click()
        recovery_status = recovery_response.value.status
        page.wait_for_timeout(150)
        false_success = page.get_by_text("Se o e-mail existir, enviaremos as instruções.", exact=True).is_visible()
        if recovery_status == 503 and false_success:
            findings.append({"name": "Password recovery UI reports instructions after backend 503", "status": "failed", "owner": "AuthPage shared integration", "data": "fictional"})
        else:
            assert recovery_status == 503 and not false_success
            expect(page.get_by_text("Recuperação automática ainda indisponível.", exact=False)).to_be_visible()
            passed("Password recovery UI displays backend unavailability without false delivery")

        page.get_by_test_id("auth-toggle-mode").click()
        page.get_by_test_id("auth-name-input").fill("Pessoa Fictícia Conta B")
        page.get_by_test_id("auth-email-input").fill("browser-b@example.invalid")
        page.get_by_test_id("auth-password-input").fill("fictional-browser-account-b-password")
        page.get_by_test_id("auth-submit-button").click()
        expect(page.get_by_test_id("studio-root")).to_be_visible()
        page.get_by_test_id("nav-g360-crm").click()
        page.get_by_test_id("crm-tab-contract").click()
        if page.get_by_text("Prestador Privado Fictício Conta A", exact=True).count():
            findings.append({"name": "Account B sees account A provider data from unscoped localStorage", "status": "failed", "owner": "Antigravity CRM contract storage", "data": "fictional"})
            page.screenshot(path=str(FIXTURE / "cross-account-provider-finding.png"), full_page=True)
        else:
            passed("Account B does not display account A provider data")
        context.close()
        browser.close()
finally:
    proxy.shutdown()
    proxy.server_close()
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
    server_log.close()
    result = {"fixture": str(FIXTURE), "browser": "/usr/bin/chromium", "checks": checks, "findings": findings, "pageErrors": errors, "blockedExternalHosts": sorted(set(blocked)),
              "limitations": ["No real Firebase/OAuth/Firestore flow", "Office view is read-only", "Contract download is HTML, not PDF", "No message, signature or payment sent"]}
    (FIXTURE / "browser-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
if findings:
    raise SystemExit(2)
