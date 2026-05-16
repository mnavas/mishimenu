#!/usr/bin/env python3
"""MishiMenu CLI — install, start, stop, update, and manage your server."""

import base64
import getpass
import hashlib
import hmac
import json
import os
import platform
import re
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path

# ── Platform ──────────────────────────────────────────────────────────────────

def _cmd():
    return "mishimenu" if platform.system() == "Windows" else "./mishimenu"

# ── Colors ────────────────────────────────────────────────────────────────────

def _supports_color():
    if platform.system() == "Windows":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7)
            return True
        except Exception:
            return False
    return sys.stdout.isatty()

_COLOR = _supports_color()

def _c(text, code): return f"\033[{code}m{text}\033[0m" if _COLOR else text
def green(t):  return _c(t, "32")
def yellow(t): return _c(t, "33")
def red(t):    return _c(t, "31")
def cyan(t):   return _c(t, "36")
def bold(t):   return _c(t, "1")
def dim(t):    return _c(t, "2")

def ok(msg):      print(green("✓ ") + msg)
def warn(msg):    print(yellow("⚠ ") + msg)
def err(msg):     print(red("✗ ") + msg)
def info(msg):    print(cyan("→ ") + msg)
def step(n, msg): print(f"\n{bold(str(n) + '.')} {msg}")

# ── Helpers ───────────────────────────────────────────────────────────────────

HERE = Path(__file__).parent.resolve()

def run(cmd, check=True):
    subprocess.run(cmd, shell=True, check=check, cwd=HERE)

def run_ok(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, cwd=HERE)
    return r.returncode == 0

def ask(prompt, default=None):
    suffix = f" [{default}]" if default else ""
    val = input(f"  {prompt}{suffix}: ").strip()
    return val or default or ""

def ask_password(prompt="Password (min 6 chars)"):
    """Prompt for a password twice and return it (or exit if they don't match)."""
    while True:
        pw  = getpass.getpass(f"  {prompt}: ")
        pw2 = getpass.getpass(f"  Confirm password: ")
        if pw == pw2:
            return pw
        print(f"  {red('Passwords do not match — try again.')}")

def ask_yes(prompt, default=True):
    suffix = "[Y/n]" if default else "[y/N]"
    val = input(f"  {prompt} {suffix} ").strip().lower()
    return (val in ("y", "yes")) if val else default

def pick(prompt, options):
    """Show a numbered list of options and return the index of the selection."""
    print(f"\n  {prompt}")
    for i, label in enumerate(options):
        print(f"  {bold(str(i + 1) + '.')} {label}")
    print()
    while True:
        raw = input(f"  Enter number (1–{len(options)}): ").strip()
        try:
            n = int(raw)
            if 1 <= n <= len(options):
                return n - 1
        except ValueError:
            pass
        print(f"  Please enter a number between 1 and {len(options)}.")

# ── JWT generation (pure Python — no Node.js needed on host) ─────────────────

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _make_jwt(payload: dict, secret: str) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body   = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}"
    sig = _b64url(
        hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    )
    return f"{signing_input}.{sig}"

def generate_supabase_keys(jwt_secret: str):
    iat = int(time.time())
    exp = iat + 5 * 365 * 24 * 60 * 60
    anon_key    = _make_jwt({"role": "anon",         "iss": "supabase-demo", "iat": iat, "exp": exp}, jwt_secret)
    service_key = _make_jwt({"role": "service_role", "iss": "supabase-demo", "iat": iat, "exp": exp}, jwt_secret)
    return anon_key, service_key

# ── Docker ────────────────────────────────────────────────────────────────────

def ensure_docker():
    if not run_ok("docker --version"):
        err("Docker is not installed.")
        sys_name = platform.system()
        if sys_name == "Linux":
            if ask_yes("Install Docker now?"):
                info("Running the official Docker install script…")
                run("curl -fsSL https://get.docker.com | sh")
                user = os.environ.get("USER", "")
                if user:
                    run(f"sudo usermod -aG docker {user}", check=False)
                ok("Docker installed.")
                print("  " + dim(f"You may need to log out and back in, then run: {_cmd()} install"))
                sys.exit(0)
        else:
            print(f"  Download Docker Desktop: {cyan('https://www.docker.com/products/docker-desktop/')}")
        sys.exit(1)

    if not run_ok("docker info"):
        err("Docker is installed but not running.")
        if platform.system() == "Linux":
            if ask_yes("Start Docker now?"):
                run("sudo systemctl start docker", check=False)
                time.sleep(2)
                if not run_ok("docker info"):
                    err("Could not start Docker. Try: sudo systemctl start docker")
                    sys.exit(1)
                ok("Docker started.")
                return
        else:
            print("  Please open Docker Desktop and wait for it to start, then try again.")
        sys.exit(1)

    if not run_ok("docker compose version"):
        err("Docker Compose plugin not found. Please update Docker Desktop.")
        sys.exit(1)

    ok("Docker is ready.")

# ── Git ───────────────────────────────────────────────────────────────────────

def ensure_git():
    if run_ok("git --version"):
        ok("Git is ready.")
        return
    err("Git is not installed.")
    if platform.system() == "Linux":
        if ask_yes("Install Git now?"):
            if run_ok("which apt-get"):
                run("sudo apt-get install -y git")
            elif run_ok("which yum"):
                run("sudo yum install -y git")
            else:
                print(f"  Install Git from: {cyan('https://git-scm.com/downloads')}")
                sys.exit(1)
            ok("Git installed.")
            return
    else:
        print(f"  Install Git from: {cyan('https://git-scm.com/downloads')}")
    sys.exit(1)

# ── Network ───────────────────────────────────────────────────────────────────

def get_local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("10.254.254.254", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    ips.discard("127.0.0.1")
    return sorted(ips)

# ── .env helpers ──────────────────────────────────────────────────────────────

def _env_file():
    return HERE / ".env"

def _check_installed():
    if not _env_file().exists():
        err("MishiMenu is not set up yet.")
        print("  Run " + bold(f"{_cmd()} install") + " first.")
        sys.exit(1)

def _print_urls(app_url=None):
    if app_url:
        base = app_url
        print("  App:       " + cyan(base))
        print("  Dashboard: " + bold(cyan(base + "/dashboard")))
        print("  Studio:    " + cyan(base.replace(":3000", ":3001")))
        return
    ips = get_local_ips()
    if ips:
        base = f"http://{ips[0]}:3000"
        print("  App:       " + cyan(base))
        print("  Dashboard: " + bold(cyan(base + "/dashboard")))
        print("  Studio:    " + cyan(f"http://{ips[0]}:3001"))

def _read_env_value(key: str) -> str:
    env = _env_file()
    if not env.exists():
        return ""
    for line in env.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line[len(key) + 1:].strip()
    return ""

# ── Commands ──────────────────────────────────────────────────────────────────

def _wait_for_supabase(max_wait=120):
    """Poll GoTrue health endpoint until Supabase is ready."""
    import urllib.request
    import urllib.error
    app_url = _read_env_value("NEXT_PUBLIC_SUPABASE_URL") or "http://localhost:8000"
    health_url = f"{app_url}/auth/v1/health"
    info(f"Waiting for Supabase to be ready…")
    for _ in range(max_wait // 3):
        try:
            urllib.request.urlopen(health_url, timeout=2)
            ok("Supabase is ready.")
            return
        except Exception:
            time.sleep(3)
    warn("Supabase did not become ready in time. You may need to run seed/add-owner manually.")


def _parse_accepted_payments(raw: str) -> str:
    """Convert 'deuna,cash' → PostgreSQL array literal '{deuna,cash}'."""
    if not raw:
        raw = "deuna,cash"
    methods = [m.strip() for m in raw.split(",") if m.strip()]
    return "{" + ",".join(methods) + "}"


def cmd_seed():
    """Insert (or update) the restaurant row from .env values."""
    _check_installed()
    name            = _read_env_value("RESTAURANT_NAME")
    address         = _read_env_value("RESTAURANT_ADDRESS")
    phone           = _read_env_value("RESTAURANT_PHONE")
    ruc             = _read_env_value("RESTAURANT_RUC")
    # Payment config
    payment_policy  = _read_env_value("RESTAURANT_PAYMENT_POLICY") or "upfront"
    accepted_raw    = _read_env_value("RESTAURANT_ACCEPTED_PAYMENTS") or "deuna,cash"
    accepted_arr    = _parse_accepted_payments(accepted_raw)
    # DeUna
    deuna_qr        = _read_env_value("RESTAURANT_DEUNA_QR_URL")
    deuna_acct      = _read_env_value("RESTAURANT_DEUNA_ACCOUNT_NAME")
    # Sipi
    sipi_qr         = _read_env_value("RESTAURANT_SIPI_QR_URL")
    sipi_acct       = _read_env_value("RESTAURANT_SIPI_ACCOUNT_NAME")
    # Transfer
    transfer_bank   = _read_env_value("RESTAURANT_TRANSFER_BANK")
    transfer_num    = _read_env_value("RESTAURANT_TRANSFER_ACCOUNT_NUMBER")
    transfer_name   = _read_env_value("RESTAURANT_TRANSFER_ACCOUNT_NAME")

    if not name:
        err("RESTAURANT_NAME not set in .env. Run: ./mishimenu install")
        sys.exit(1)

    sql = (
        "INSERT INTO restaurant ("
        "  name, address, phone, ruc,"
        "  payment_policy, accepted_payment_methods,"
        "  deuna_qr_url, deuna_account_name,"
        "  sipi_qr_url, sipi_account_name,"
        "  transfer_bank, transfer_account_number, transfer_account_name"
        ") VALUES ("
        f"  {_sql_str(name)}, {_sql_str(address)}, {_sql_str(phone)}, {_sql_str(ruc)},"
        f"  {_sql_str(payment_policy)}, '{accepted_arr}',"
        f"  {_sql_str(deuna_qr)}, {_sql_str(deuna_acct)},"
        f"  {_sql_str(sipi_qr)}, {_sql_str(sipi_acct)},"
        f"  {_sql_str(transfer_bank)}, {_sql_str(transfer_num)}, {_sql_str(transfer_name)}"
        ") ON CONFLICT DO NOTHING;"
    )
    run(f"docker compose exec -T db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d postgres -c \"{sql}\"'")

    # Also run an UPDATE in case the row already exists
    update_sql = (
        "UPDATE restaurant SET"
        f"  name={_sql_str(name)}, address={_sql_str(address)}, phone={_sql_str(phone)}, ruc={_sql_str(ruc)},"
        f"  payment_policy={_sql_str(payment_policy)}, accepted_payment_methods='{accepted_arr}',"
        f"  deuna_qr_url={_sql_str(deuna_qr)}, deuna_account_name={_sql_str(deuna_acct)},"
        f"  sipi_qr_url={_sql_str(sipi_qr)}, sipi_account_name={_sql_str(sipi_acct)},"
        f"  transfer_bank={_sql_str(transfer_bank)}, transfer_account_number={_sql_str(transfer_num)},"
        f"  transfer_account_name={_sql_str(transfer_name)};"
    )
    run(f"docker compose exec -T db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d postgres -c \"{update_sql}\"'")
    ok(f"Restaurant row seeded: {bold(name)} — policy: {payment_policy} — methods: {accepted_raw}")


def _sql_str(val: str) -> str:
    if not val:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def cmd_add_owner():
    """Create a Supabase auth user as the restaurant owner."""
    import urllib.request
    import urllib.error
    _check_installed()

    print()
    print(bold("Add restaurant owner account"))
    print()
    email    = ask("Owner email")
    password = ask_password()

    if not email or not password:
        err("Email and password are required.")
        sys.exit(1)

    service_key = _read_env_value("SERVICE_ROLE_KEY") or _read_env_value("SUPABASE_SERVICE_ROLE_KEY")
    supa_url    = _read_env_value("NEXT_PUBLIC_SUPABASE_URL") or "http://localhost:8000"
    api_url     = f"{supa_url}/auth/v1/admin/users"

    payload = json.dumps({"email": email, "password": password, "email_confirm": True}).encode()
    req = urllib.request.Request(
        api_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            user_data = json.loads(resp.read())
        ok(f"Owner account created: {bold(email)}  (id: {user_data.get('id', '?')})")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        err(f"GoTrue error ({e.code}): {body}")
        sys.exit(1)


def cmd_install():
    print(f"\n{bold('MishiMenu — Installation')}\n")

    env_file = _env_file()
    if env_file.exists():
        ok("MishiMenu is already installed.")
        print("  Run " + bold(f"{_cmd()} start") + "     to start the server.")
        print("  Run " + bold(f"{_cmd()} status") + "    to check containers.")
        return

    step(1, "Checking Docker…")
    ensure_docker()

    env_example = HERE / ".env.example"
    if not env_example.exists():
        err(".env.example not found. Make sure you're in the MishiMenu folder.")
        sys.exit(1)

    step(2, "App URL")
    print(f"  {dim('This is the address customers will use to access MishiMenu.')}")
    ips = get_local_ips()
    url_options = [f"http://{ip}:3000" for ip in ips] + ["http://localhost:3000", "Enter manually"]
    idx = pick("Select the app URL:", url_options)
    if url_options[idx] == "Enter manually":
        app_url = ask("App URL").rstrip("/")
    else:
        app_url = url_options[idx]
        ok(f"Using: {cyan(app_url)}")

    print()
    step(3, "Owner account")
    print(f"  {dim('This is the admin login for the MishiMenu dashboard.')}")
    print()
    owner_email    = ask("Owner email")
    owner_password = ask_password()

    print()
    step(4, "Generating secrets…")
    postgres_password = secrets.token_urlsafe(20)
    jwt_secret        = secrets.token_hex(32)
    ocr_secret        = secrets.token_urlsafe(20)

    anon_key, service_key = generate_supabase_keys(jwt_secret)

    ok(f"Postgres password:    {dim(postgres_password)}")
    ok(f"JWT secret:           {dim(jwt_secret[:24] + '…')}")
    ok(f"OCR internal secret:  {dim(ocr_secret)}")
    ok("Supabase JWT keys:    generated")
    print(f"  {dim('All secrets are saved in .env — keep that file private.')}")

    env_content = (
        env_example.read_text()
        .replace("change-me-strong-password", postgres_password)
        .replace("change-me-at-least-32-chars-random-string", jwt_secret)
        .replace("change-me-random-string", ocr_secret)
        # Replace ${VAR} references first (used in NEXT_PUBLIC_ / SUPABASE_ lines).
        # Then replace the bare definition lines using \n prefix so we don't
        # accidentally match NEXT_PUBLIC_SUPABASE_ANON_KEY= or similar.
        .replace("${ANON_KEY}",         anon_key)
        .replace("${SERVICE_ROLE_KEY}", service_key)
        .replace("\nANON_KEY=",         f"\nANON_KEY={anon_key}")
        .replace("\nSERVICE_ROLE_KEY=", f"\nSERVICE_ROLE_KEY={service_key}")
        .replace("http://localhost:3000", app_url)
        # NEXT_PUBLIC_SUPABASE_URL must be reachable from the browser, so use
        # the same host as app_url but on port 8000 (Kong's public port).
        .replace("http://localhost:8000", app_url.replace(":3000", ":8000"))
    )
    env_content += f"\nRESTAURANT_NAME=Mi Restaurante\nOWNER_EMAIL={owner_email}\n"
    env_file.write_text(env_content)
    ok(".env saved.")

    kong_template = HERE / "docker" / "kong.yml.template"
    kong_out      = HERE / "docker" / "kong.yml"
    if kong_template.exists():
        kong_out.write_text(
            kong_template.read_text()
            .replace("${SUPABASE_ANON_KEY}",   anon_key)
            .replace("${SUPABASE_SERVICE_KEY}", service_key)
        )
        ok("docker/kong.yml written.")

    step(5, "Building and starting MishiMenu…")
    print(f"  {dim('This will take a few minutes the first time — images are being downloaded.')}")
    run("docker compose up -d --build")

    step(6, "Initializing database…")
    _wait_for_supabase()
    seed_sql = (
        "INSERT INTO restaurant (name, payment_policy, accepted_payment_methods) "
        "VALUES ('Mi Restaurante', 'upfront', '{cash}') ON CONFLICT DO NOTHING;"
    )
    try:
        subprocess.run(
            "docker compose exec -T db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d postgres'",
            input=seed_sql.encode(), shell=True, check=True, cwd=HERE,
        )
        ok("Database initialized.")
    except Exception as e:
        warn(f"DB init failed: {e}. Run {bold(_cmd() + ' seed')} later.")

    step(7, "Creating owner account…")
    if owner_email and owner_password:
        try:
            import urllib.request, urllib.error
            supa_url = app_url.replace(":3000", ":8000") if ":3000" in app_url else "http://localhost:8000"
            api_url  = f"{supa_url}/auth/v1/admin/users"
            payload  = json.dumps({"email": owner_email, "password": owner_password, "email_confirm": True}).encode()
            req = urllib.request.Request(
                api_url, data=payload,
                headers={"Content-Type": "application/json",
                         "Authorization": f"Bearer {service_key}",
                         "apikey": service_key},
                method="POST",
            )
            with urllib.request.urlopen(req) as resp:
                json.loads(resp.read())
            ok(f"Owner account created: {bold(owner_email)}")
        except Exception as e:
            warn(f"Could not create owner account: {e}. Run {bold(_cmd() + ' add-owner')} later.")
    else:
        warn(f"No credentials entered. Run {bold(_cmd() + ' add-owner')} to create the owner account.")

    print()
    print("─" * 56)
    ok(bold("MishiMenu is running!"))
    print()
    print("  Open in your browser:")
    _print_urls(app_url)
    print()
    print(f"  Dashboard:  {cyan(app_url + '/dashboard')}")
    print()
    print(f"  {bold('Next step:')} log in and go to {cyan(app_url + '/dashboard/settings')}")
    print(f"  {dim('Set your restaurant name, payment methods, and account details there.')}")
    print()
    print(f"  Run {bold(_cmd() + ' help')} to see all available commands.")
    print()


def cmd_start():
    _check_installed()
    info("Starting MishiMenu…")
    run("docker compose up -d")
    print()
    ok(bold("MishiMenu started."))
    print()
    _print_urls(_read_env_value("NEXT_PUBLIC_APP_URL"))
    print()


def cmd_stop():
    info("Stopping MishiMenu…")
    run("docker compose down")
    ok("MishiMenu stopped.")


def cmd_restart():
    _check_installed()
    info("Restarting MishiMenu…")
    run("docker compose restart")
    print()
    ok(bold("MishiMenu restarted."))
    print()
    _print_urls(_read_env_value("NEXT_PUBLIC_APP_URL"))
    print()


def cmd_logs():
    svc = sys.argv[2] if len(sys.argv) > 2 else ""
    run(f"docker compose logs -f {svc}".strip(), check=False)


def cmd_status():
    run("docker compose ps")


def cmd_update():
    print(f"\n{bold('MishiMenu — Update')}\n")

    step(1, "Checking Git…")
    ensure_git()

    step(2, "Pulling latest version…")
    run("git pull origin main")

    step(3, "Rebuilding app image…")
    run("docker compose build mishimenu")

    step(4, "Restarting…")
    run("docker compose up -d")

    print()
    ok(bold("MishiMenu updated and restarted."))
    _print_urls(_read_env_value("NEXT_PUBLIC_APP_URL"))


def cmd_hostname():
    ips = get_local_ips()
    print()
    if not ips:
        warn("No network addresses detected.")
        return
    print(bold("MishiMenu is reachable at:"))
    print()
    for ip in ips:
        print("  App:     " + cyan(f"http://{ip}:3000"))
        print("  Studio:  " + cyan(f"http://{ip}:3001"))
        print()
    print(dim("  Share the App URL with restaurant customers and staff."))
    print(dim("  Studio is for administrators only — don't expose it publicly."))
    print()


def cmd_backup():
    _check_installed()
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = HERE / "backups"
    backup_dir.mkdir(exist_ok=True)
    out_file = backup_dir / f"mishimenu_db_{timestamp}.sql"

    info(f"Backing up database to {dim(str(out_file))}…")
    pg_pass = _read_env_value("POSTGRES_PASSWORD")
    run(
        f'docker compose exec -T db bash -c "PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U postgres -d postgres" > "{out_file}"',
        check=False,
    )
    if out_file.exists() and out_file.stat().st_size > 0:
        ok(f"Backup saved: {bold(out_file.name)}")
    else:
        err("Backup failed or produced an empty file.")
        if out_file.exists():
            out_file.unlink()
        sys.exit(1)


def cmd_restore():
    if len(sys.argv) < 3:
        err("Usage: mishimenu restore <backup-file.sql>")
        sys.exit(1)
    backup_path = Path(sys.argv[2])
    if not backup_path.exists():
        err(f"File not found: {backup_path}")
        sys.exit(1)
    _check_installed()
    warn(f"This will OVERWRITE the current database with: {bold(backup_path.name)}")
    if not ask_yes("Are you sure?", default=False):
        info("Restore cancelled.")
        return
    info("Restoring database…")
    run(f'docker compose exec -T db bash -c "PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d postgres" < "{backup_path}"')
    ok("Database restored. Restart MishiMenu to apply.")
    print("  " + bold(f"{_cmd()} restart"))


def cmd_keys():
    _check_installed()
    print()
    print(bold("MishiMenu — current secrets"))
    print()
    for key in ("POSTGRES_PASSWORD", "JWT_SECRET", "OCR_INTERNAL_SECRET",
                "ANON_KEY", "SERVICE_ROLE_KEY"):
        val = _read_env_value(key)
        display = val[:24] + "…" if len(val) > 28 else val
        print(f"  {key:<30} {dim(display)}")
    print()
    print(dim("  Full values are in .env — keep that file private."))
    print()


def cmd_help():
    print(f"""
{bold('MishiMenu')} — self-hosted restaurant ordering platform

{bold('USAGE')}
  ./mishimenu <command>       (Linux / Mac)
  mishimenu <command>         (Windows)

{bold('COMMANDS')}
  {green('install')}      First-time setup: picks app URL, creates owner account, generates
                 secrets, builds and starts everything. Configure the restaurant
                 (name, payment methods, etc.) at /dashboard/settings afterwards.
  {green('start')}        Start all containers
  {green('stop')}         Stop all containers
  {green('restart')}      Restart all containers
  {green('update')}       Pull the latest version, rebuild the app, and restart
  {green('logs')}         View live logs  (Ctrl+C to stop)
                 Optional: {dim('./mishimenu logs mishimenu')}  — app only
                 Optional: {dim('./mishimenu logs db')}        — database only
  {green('status')}       Show container status
  {green('seed')}         Insert/update the restaurant row from .env values
  {green('add-owner')}    Create the owner login account (email + password)
  {green('backup')}       Dump the database to backups/mishimenu_db_<timestamp>.sql
  {green('restore')}      Restore a database backup: {dim('./mishimenu restore backups/file.sql')}
  {green('hostname')}     List all URLs where MishiMenu is reachable on the network
  {green('keys')}         Show the generated secrets (truncated)
  {green('help')}         Show this message

{bold('PORTS')}
  3000  MishiMenu app  (share this URL with customers)
  3001  Supabase Studio (admin panel — keep private)
  8000  Supabase API (used internally by the app)
""")


# ── Entry point ───────────────────────────────────────────────────────────────

COMMANDS = {
    "install":    cmd_install,
    "start":      cmd_start,
    "stop":       cmd_stop,
    "restart":    cmd_restart,
    "logs":       cmd_logs,
    "status":     cmd_status,
    "update":     cmd_update,
    "seed":       cmd_seed,
    "add-owner":  cmd_add_owner,
    "hostname":   cmd_hostname,
    "backup":     cmd_backup,
    "restore":    cmd_restore,
    "keys":       cmd_keys,
    "help":       cmd_help,
    "-h":         cmd_help,
    "--help":     cmd_help,
}

def main():
    if len(sys.argv) < 2:
        cmd_help()
        sys.exit(0)
    cmd = sys.argv[1].lower()
    if cmd not in COMMANDS:
        err(f"Unknown command: {cmd}")
        print("  Run " + bold(f"{_cmd()} help") + " for available commands.")
        sys.exit(1)
    COMMANDS[cmd]()

if __name__ == "__main__":
    main()
