# Deploying Minefall on a VPS

The whole stack (PostgreSQL, migrations, API, web) runs with Docker Compose. A host Nginx
terminates HTTPS and forwards everything, WebSockets included, to the `web` container.

```
Internet ──HTTPS──▶ host Nginx (443, Let's Encrypt) ──▶ 127.0.0.1:8090 web (Nginx container)
                                                          ├─ static Vue app
                                                          └─ /auth, /socket.io ──▶ api:3000 ──▶ postgres
```

## 1. One-time server setup

Requirements: a Linux VPS with Docker (with the Compose plugin), Nginx, Certbot and Git, plus
a domain whose DNS points to the server.

```bash
git clone https://github.com/ghofrane-soulmi/MineFall.git ~/minefall
cd ~/minefall
cp .env.example .env
```

Edit `.env`:

```ini
# Bind to localhost only: the host Nginx is the only public entry point.
WEB_PORT=127.0.0.1:8090
POSTGRES_PORT=127.0.0.1:5442
POSTGRES_PASSWORD=<long random string>
JWT_SECRET=<long random string>      # e.g. openssl rand -base64 48
PUBLIC_URL=https://minefall.example.com
```

Start it:

```bash
docker compose up -d --build
curl http://127.0.0.1:8090/health      # {"status":"ok"}
```

## 2. HTTPS with Nginx + Let's Encrypt

```bash
sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/minefall
sudo sed -i 's/minefall.example.com/YOUR_DOMAIN/g' /etc/nginx/sites-available/minefall
sudo ln -s /etc/nginx/sites-available/minefall /etc/nginx/sites-enabled/
sudo certbot --nginx -d YOUR_DOMAIN
sudo nginx -t && sudo systemctl reload nginx
```

The important part for real time is the WebSocket upgrade (`Upgrade` / `Connection` headers
and a long `proxy_read_timeout`); it is already in `nginx-host.conf`.

## 3. Automatic deploys from GitHub

`.github/workflows/deploy.yml` runs after CI succeeds on `main`: it connects over SSH, resets
the checkout to `origin/main` and runs `docker compose up -d --build`.

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret        | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| `VPS_HOST`    | server IP or hostname                                       |
| `VPS_USER`    | SSH user (member of the `docker` group)                     |
| `VPS_SSH_KEY` | private key whose public key is in `~/.ssh/authorized_keys` |
| `VPS_PATH`    | optional, defaults to `~/minefall`                          |

Without these secrets the deploy job is skipped (CI still runs).

## Useful commands

```bash
docker compose logs -f api                     # API logs
docker compose exec postgres psql -U minefall  # database shell
docker compose up -d --build                   # redeploy manually
```
