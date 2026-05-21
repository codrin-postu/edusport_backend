# DEPLOY — EduSport production stack

This is the main deployment guide for the EduSport platform. The frontend repo
(`edusport_frontend`) keeps a slim DEPLOY.md and links here for VM bootstrap,
reverse proxy, TLS, and backup details.

The reference target is a single Ubuntu 24.04 LTS VM running Docker. Frontend,
backend, Postgres, and nginx all run as containers on a shared Docker network
(`edusport_net`). Only the nginx proxy publishes ports 80/443 to the host.

## Overview

```
Internet -> nginx (host:443) -> docker network edusport_net
                                 |- frontend  (next.js, port 3000)
                                 |- backend   (strapi, port 1337)
                                 `- postgres  (port 5432, internal only)
```

Domains:

- `scoaladepatinaj.com`        -> frontend
- `cms.scoaladepatinaj.com`    -> backend (Strapi admin + API)

## Prerequisites

- Root or sudo access to the VM.
- DNS control for `scoaladepatinaj.com`.
- SSH public key for the deploy user (Marius's `ssh-ed25519 ... root@edusport`).
- GitHub repository admin to add deploy keys.

---

## 1. VM bootstrap (Ubuntu 24.04 LTS)

```bash
# As root on the VM.
apt-get update && apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg ufw git

# Docker engine + compose plugin (official repo).
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Firewall.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Swap (only if the VM has under 2 GB of RAM).
if [ "$(free -m | awk '/^Mem:/ {print $2}')" -lt 2048 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
```

## 2. Domain + DNS

Create two A-records pointing to the VM's public IP:

| Record                          | Type | Value          |
|---------------------------------|------|----------------|
| `scoaladepatinaj.com`           | A    | `<VM IP>`      |
| `cms.scoaladepatinaj.com`       | A    | `<VM IP>`      |

Wait for propagation (`dig +short scoaladepatinaj.com`) before requesting TLS
certificates.

## 3. Repo provisioning + SSH deploy key

Marius's public key is the VM's root SSH key. To let the VM pull from GitHub,
add it as a **read-only deploy key** on each repository:

1. Go to `https://github.com/<org>/edusport_backend/settings/keys`.
2. Click *Add deploy key*.
3. Paste the full `ssh-ed25519 AAAAC3N... root@edusport` line.
4. Leave *Allow write access* unchecked. Save.
5. Repeat for `edusport_frontend`.

Then on the VM:

```bash
mkdir -p /opt/edusport
cd /opt/edusport
git clone git@github.com:<org>/edusport_backend.git
git clone git@github.com:<org>/edusport_frontend.git
```

## 4. Shared Docker network

Created once. Both compose stacks reference it as `external: true`.

```bash
docker network create edusport_net
```

## 5. Environment file

```bash
cd /opt/edusport/edusport_backend
cp .env.example .env.production
# Generate strong secrets:
for key in APP_KEYS API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT JWT_SECRET ENCRYPTION_KEY DATABASE_PASSWORD; do
  echo "$key=$(openssl rand -base64 32)"
done
# Paste the generated values into .env.production.
# Set FRONTEND_ORIGIN=https://scoaladepatinaj.com
```

`APP_KEYS` expects a comma-separated list. Generate two values and join them
with a comma.

## 6. PostgreSQL initialisation

The `postgres:16-alpine` service reads `POSTGRES_*` from `.env.production`. On
first boot it creates the database, user, and password. Verify after the first
deploy:

```bash
docker compose -f docker-compose.production.yml exec postgres psql -U strapi -d strapi -c '\dt'
```

To connect from the host for ad-hoc queries:

```bash
docker compose -f docker-compose.production.yml exec postgres psql -U strapi
```

## 7. First-run

```bash
cd /opt/edusport/edusport_backend
./scripts/deploy.sh
```

Once the health check is green, open `https://cms.scoaladepatinaj.com/admin`
and create the first admin user via the Strapi UI.

## 8. Content seeding and import

Two paths are supported:

- **Seed scripts** for fresh databases:
  ```bash
  docker compose -f docker-compose.production.yml exec backend node scripts/seed-homepage.js
  docker compose -f docker-compose.production.yml exec backend node scripts/seed-cursuri-page.js
  docker compose -f docker-compose.production.yml exec backend node scripts/seed-regulations.js
  docker compose -f docker-compose.production.yml exec backend node scripts/seed-pricing.js
  docker compose -f docker-compose.production.yml exec backend node scripts/seed-content.js
  ```

- **`strapi export` / `strapi import`** for migrating an existing dataset.
  On the source environment:
  ```bash
  docker compose exec strapi npx strapi export --no-encrypt -f /tmp/export
  docker cp <container>:/tmp/export.tar.gz ./export.tar.gz
  ```
  Then on the production VM:
  ```bash
  docker cp ./export.tar.gz edusport_backend:/tmp/export.tar.gz
  docker compose -f docker-compose.production.yml exec backend \
    npx strapi import --no-encrypt -f /tmp/export.tar.gz
  ```

## 9. CORS configuration

CORS is environment-driven via the `FRONTEND_ORIGIN` variable read by
`config/middlewares.ts`. Multiple origins can be supplied comma-separated:

```
FRONTEND_ORIGIN=https://scoaladepatinaj.com,https://www.scoaladepatinaj.com
```

When `NODE_ENV` is not `production`, the middleware falls back to `*` so local
dev does not need explicit origins.

## 10. Webhook to the frontend

Strapi must notify the frontend's `/api/revalidate` endpoint whenever editorial
content changes. In the Strapi admin:

1. Go to *Settings -> Webhooks -> Create new webhook*.
2. **Name:** `Frontend revalidation`.
3. **URL:** `https://scoaladepatinaj.com/api/revalidate`.
4. **Method:** `POST` (the default).
5. **Headers:** add a single header
   `x-revalidate-secret: <value of NEXT_REVALIDATE_SECRET in frontend env>`.
6. **Events:** check
   - Entry: publish, update, unpublish, delete
   - Media: create, update, delete
7. Save and click *Trigger* once to smoke-test.

## 11. Reverse proxy (nginx)

The host nginx terminates TLS and proxies to the two services over the Docker
network. Use container-name DNS (`frontend`, `backend`) so the proxy itself can
be on the same network (run it as a container that joins `edusport_net`) or
keep the proxy on the host and use the host-side ports if you publish them.

Create `/etc/nginx/sites-available/edusport.conf`:

```nginx
# Public site.
server {
    listen 80;
    listen [::]:80;
    server_name scoaladepatinaj.com www.scoaladepatinaj.com;

    # certbot challenges:
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://scoaladepatinaj.com$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name scoaladepatinaj.com;

    ssl_certificate     /etc/letsencrypt/live/scoaladepatinaj.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scoaladepatinaj.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}

# CMS / admin / API.
server {
    listen 80;
    listen [::]:80;
    server_name cms.scoaladepatinaj.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://cms.scoaladepatinaj.com$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cms.scoaladepatinaj.com;

    ssl_certificate     /etc/letsencrypt/live/cms.scoaladepatinaj.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cms.scoaladepatinaj.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Strapi uploads.
    client_max_body_size 50M;

    location / {
        proxy_pass         http://backend:1337;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $host;

        # Strapi admin uses websockets for HMR-like updates.
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/edusport.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

If nginx itself runs as a container, point it at `edusport_net` so the
upstreams resolve. Otherwise publish `127.0.0.1:3000` and `127.0.0.1:1337` in
the compose files and update `proxy_pass` accordingly.

## 12. TLS via certbot (Docker-image flow)

Use the official certbot image so no system Python is required.

```bash
mkdir -p /var/www/certbot /etc/letsencrypt

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d scoaladepatinaj.com -d www.scoaladepatinaj.com \
  -d cms.scoaladepatinaj.com \
  --email ops@scoaladepatinaj.com --agree-tos --no-eff-email

systemctl reload nginx
```

Renewal cron (runs daily at 04:00 and reloads nginx if anything changed):

```cron
0 4 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --quiet && systemctl reload nginx
```

## 13. Backups and off-VM storage

Enable the on-VM backup cron:

```cron
0 3 * * * /opt/edusport/edusport_backend/scripts/backup.sh >> /var/log/edusport-backup.log 2>&1
```

This produces two files per day in `/opt/edusport/edusport_backend/backups/`:

- `strapi-YYYY-MM-DD.sql.gz`
- `uploads-YYYY-MM-DD.tar.gz`

Last 14 of each are kept automatically.

### Off-VM copy via rclone (S3-compatible)

```bash
apt-get install -y rclone
rclone config  # set up an S3-compatible remote called `edusport-backups`
```

Cron:

```cron
30 3 * * * rclone sync /opt/edusport/edusport_backend/backups edusport-backups:edusport/backups --transfers=4 >> /var/log/edusport-rclone.log 2>&1
```

### Off-VM copy via rsync (secondary host)

```cron
30 3 * * * rsync -az --delete /opt/edusport/edusport_backend/backups/ backup@backups.example.com:/srv/edusport/ >> /var/log/edusport-rsync.log 2>&1
```

## 14. Updating

To roll out a new release, SSH in and rerun the deploy script:

```bash
cd /opt/edusport/edusport_backend
./scripts/deploy.sh
```

The script fast-forwards `main`, rebuilds the image, restarts the backend, and
probes `/_health`.

## 15. Rollback

```bash
cd /opt/edusport/edusport_backend
git fetch
git reset --hard <previous-commit-sha>
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d backend
```

If a bad migration corrupted the database, restore the most recent dump:

```bash
./scripts/restore.sh backups/strapi-YYYY-MM-DD.sql.gz
```

## 16. GitHub Actions (later)

A disabled-by-default workflow lives at `.github/workflows/deploy.yml`. To turn
it on:

1. Configure the four secrets it expects:
   - `VM_HOST`, `VM_USER`, `VM_SSH_KEY`, `VM_BACKEND_PATH`.
2. Remove the `if: false` guard on the `deploy` job.

The workflow just SSHes in and runs the same `scripts/deploy.sh`. There is no
duplication of deploy logic.

## Troubleshooting

- **`pg_isready` keeps failing in deploy.sh** — check `.env.production`
  credentials match what Postgres was initialised with. Once the named volume
  `pgdata` is created, the credentials are baked in; to change them you must
  drop the volume.
- **Strapi boots but admin returns 502 via nginx** — verify the proxy can
  resolve `backend` (run `docker exec edusport_proxy nslookup backend`). Both
  containers must share `edusport_net`.
- **Uploads disappear after a redeploy** — confirm the `uploads` named volume
  is still mounted (`docker volume ls | grep uploads`). The Dockerfile's
  WORKDIR is `/opt/app`, so the mount target must be `/opt/app/public/uploads`.

## Reference

- Health endpoint: `https://cms.scoaladepatinaj.com/_health`
- Admin UI: `https://cms.scoaladepatinaj.com/admin`
- Internal service DNS (docker network): `frontend`, `backend`, `postgres`
- Backup directory: `/opt/edusport/edusport_backend/backups/`
- Compose file: `docker-compose.production.yml`
