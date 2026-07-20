# SQLite Migration Deployment Runbook

## Scope and approval gate

This runbook is for `/var/www/dj-vault-v2` and PM2 process `dj-vault`. Run it only after an interactive SSH login to the VPS. Do not put these commands inside local PowerShell `ssh "..."` invocations or a remote `&&` chain. Run each command, read its result, and stop at every failure.

Production deployment requires explicit approval after the verified code has been pushed and after the backup location and free disk space have been confirmed. Never deploy, edit, or delete legacy JSON until those conditions are met.

The SSH user must own the application checkout and PM2 process. `sudo` is used only for the persistent data and backup directories.

## Environment and Nginx

Set `.env` privately. Do not print, commit, or send it. Required values are:

```dotenv
NEXT_PUBLIC_APP_URL=https://vault.example.com
AUTH_URL=https://vault.example.com
DATA_DIRECTORY=/var/lib/dj-vault
AUTH_SECRET=<private random value with at least 32 characters>

SMTP_HOST=<smtp host>
SMTP_PORT=<465 or 587>
SMTP_SECURE=<true for implicit TLS, otherwise false>
SMTP_STARTTLS=<true for STARTTLS, otherwise false>
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
SMTP_FROM=<display sender>
SMTP_ENVELOPE_FROM=<envelope sender>

S3_ENDPOINT=<https S3-compatible endpoint>
S3_REGION=<S3 region>
S3_BUCKET=<S3 bucket>
S3_ADDRESSING_STYLE=<virtual-hosted or path-style>
S3_ACCESS_KEY=<S3 access key>
S3_SECRET_KEY=<S3 secret key>

YOOKASSA_SHOP_ID=<YooKassa shop id>
YOOKASSA_SECRET_KEY=<YooKassa secret key>
PAYMENT_SMOKE_TEST_ENABLED=false
```

`DATA_DIRECTORY` must be an absolute persistent directory outside the release checkout and `.next`; `/var/lib/dj-vault` is recommended. The application currently does not read an `ADMIN_EMAIL` environment variable. Admin access is configured in `lib/auth/admin.ts`, so changing it is a separate reviewed code change.

Nginx must redirect HTTP to HTTPS, hide its version, and overwrite client-address headers. Response security headers are owned by Next.js; do not add a second CSP, HSTS, frame, or permissions policy in Nginx.

```nginx
server_tokens off;

server {
    listen 80;
    listen [::]:80;
    server_name vault.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vault.example.com;

    # Configure the approved certificate directives here.

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Do not use `proxy_add_x_forwarded_for`, because it preserves an untrusted client value. Before any reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Release, backup, and migration

### 1. Inspect, stop writes, and back up

Run these after approval. Stopping PM2 before the backup prevents writes from racing the migration.

```bash
cd /var/www/dj-vault-v2
APP_DIR=/var/www/dj-vault-v2
PM2_NAME=dj-vault
BACKUP_ROOT=/var/backups/dj-vault

git status --short
git branch --show-current
git rev-parse HEAD
df -h "$APP_DIR" /var/lib /var/backups
test -f "$APP_DIR/.env"

DATA_DIRECTORY="$(sed -n 's/^DATA_DIRECTORY=//p' "$APP_DIR/.env" | tail -n 1)"
test -n "$DATA_DIRECTORY"
test "${DATA_DIRECTORY#/}" != "$DATA_DIRECTORY"
test "$DATA_DIRECTORY" != "$APP_DIR/.data"

pm2 describe "$PM2_NAME"
pm2 stop "$PM2_NAME"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
sudo install -d -m 0700 -o "$(id -un)" -g "$(id -gn)" "$BACKUP_ROOT"
install -d -m 0700 "$BACKUP_DIR"

git rev-parse HEAD > "$BACKUP_DIR/git-revision.txt"
git branch --show-current > "$BACKUP_DIR/git-branch.txt"
cp --preserve=mode,timestamps "$APP_DIR/.env" "$BACKUP_DIR/.env"

if test -d "$APP_DIR/.data"; then
  tar -C "$APP_DIR" -czf "$BACKUP_DIR/legacy-dot-data.tar.gz" .data
fi

if test -d "$DATA_DIRECTORY"; then
  tar -C "$(dirname "$DATA_DIRECTORY")" -czf "$BACKUP_DIR/database-directory.tar.gz" "$(basename "$DATA_DIRECTORY")"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -printf '%f\n' | sort > "$BACKUP_DIR/manifest.txt"
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/SHA256SUMS"
cat "$BACKUP_DIR/manifest.txt"
```

The backup includes `.data`, any existing persistent database directory, `.env`, and the current Git revision. Never use `rm`, `git clean`, or an in-place JSON conversion against `$APP_DIR/.data`.

### 2. Update the release and preserve import input

```bash
cd /var/www/dj-vault-v2
RELEASE_BRANCH="$(git branch --show-current)"
test -n "$RELEASE_BRANCH"
git status --short
git fetch --prune origin
git pull --ff-only origin "$RELEASE_BRANCH"
npm ci
npm run build

sudo install -d -m 0750 -o "$(id -un)" -g "$(id -gn)" "$DATA_DIRECTORY"

LEGACY_SOURCE="$APP_DIR/.data"
for LEGACY_FILE in users.json payments.json promo-codes.json collections.json downloads.json password-resets.json; do
  if test -f "$LEGACY_SOURCE/$LEGACY_FILE"; then
    if test -e "$DATA_DIRECTORY/$LEGACY_FILE"; then
      cmp --silent "$LEGACY_SOURCE/$LEGACY_FILE" "$DATA_DIRECTORY/$LEGACY_FILE"
    else
      cp --preserve=mode,timestamps "$LEGACY_SOURCE/$LEGACY_FILE" "$DATA_DIRECTORY/$LEGACY_FILE"
    fi
  fi
done
```

The copy is one-way and only creates missing import inputs in the persistent directory. A different existing copy fails `cmp`; investigate its provenance rather than overwriting it. The original JSON stays in `$APP_DIR/.data` unchanged.

### 3. Trigger and verify SQLite migration before traffic

The app imports legacy JSON when its runtime database opens. Trigger that code path while PM2 is stopped, then compare legacy JSON and SQLite using the read-only verifier. It reports aggregate counts only.

```bash
cd /var/www/dj-vault-v2
DATABASE_PATH="$DATA_DIRECTORY/dj-vault.sqlite"

DATA_DIRECTORY="$DATA_DIRECTORY" NODE_ENV=production node --experimental-transform-types --input-type=module --eval 'import { closeDatabaseForTests, getRuntimeDatabase } from "./lib/database/client.ts"; try { getRuntimeDatabase(); } finally { closeDatabaseForTests(); }'

test -f "$DATABASE_PATH"
npm run data:verify -- --data-directory "$DATA_DIRECTORY" --database "$DATABASE_PATH"
```

Continue only when `marker legacy-json-v1: present`, each `json`/`sqlite` pair is `OK`, and `conflicts: none` appears. Otherwise go directly to rollback.

### 4. Start PM2 and run smoke checks

```bash
cd /var/www/dj-vault-v2
pm2 startOrReload ecosystem.config.cjs --only "$PM2_NAME" --update-env
pm2 status "$PM2_NAME"
pm2 save

LOCAL_URL=http://127.0.0.1:3000
HEADER_FILE="$(mktemp)"
AUTH_HEADER_FILE="$(mktemp)"
ADMIN_HEADER_FILE="$(mktemp)"
DOWNLOAD_HEADER_FILE="$(mktemp)"

curl --fail --silent --show-error --dump-header "$HEADER_FILE" --output /dev/null "$LOCAL_URL/"
for HEADER in Content-Security-Policy X-Content-Type-Options Referrer-Policy X-Frame-Options Permissions-Policy Strict-Transport-Security; do
  grep -qi "^$HEADER:" "$HEADER_FILE"
done
if grep -qi '^X-Powered-By:' "$HEADER_FILE"; then
  exit 1
fi

curl --silent --show-error --dump-header "$AUTH_HEADER_FILE" --output /dev/null "$LOCAL_URL/account"
grep -Eqi '^location: .*/login' "$AUTH_HEADER_FILE"

curl --silent --show-error --dump-header "$ADMIN_HEADER_FILE" --output /dev/null "$LOCAL_URL/admin"
grep -Eqi '^location: .*/login' "$ADMIN_HEADER_FILE"

curl --fail --silent --show-error --output /dev/null "$LOCAL_URL/collections"

BEFORE_DOWNLOAD_RECORDS="$(node --input-type=commonjs --eval 'const Database = require("better-sqlite3"); const db = new Database(process.argv[1], { readonly: true }); console.log(db.prepare("SELECT count(*) AS count FROM download_records").get().count); db.close();' "$DATABASE_PATH")"
DOWNLOAD_STATUS="$(curl --silent --show-error --dump-header "$DOWNLOAD_HEADER_FILE" --output /dev/null --write-out '%{http_code}' "$LOCAL_URL/api/download/1")"
test "$DOWNLOAD_STATUS" = 405
grep -Eqi '^allow: .*POST' "$DOWNLOAD_HEADER_FILE"
AFTER_DOWNLOAD_RECORDS="$(node --input-type=commonjs --eval 'const Database = require("better-sqlite3"); const db = new Database(process.argv[1], { readonly: true }); console.log(db.prepare("SELECT count(*) AS count FROM download_records").get().count); db.close();' "$DATABASE_PATH")"
test "$BEFORE_DOWNLOAD_RECORDS" = "$AFTER_DOWNLOAD_RECORDS"

curl --fail-with-body --silent --show-error --request POST --header 'content-type: application/json' --data '{"event":"unsupported"}' "$LOCAL_URL/api/payments/yookassa"

rm -f "$HEADER_FILE" "$AUTH_HEADER_FILE" "$ADMIN_HEADER_FILE" "$DOWNLOAD_HEADER_FILE"
```

The harmless webhook has no payment ID, so it cannot call YooKassa or grant access. The download GET must return `405` with `Allow: POST`; the before/after query proves it did not consume a download.

Check logs by count only, so credentials, tokens, and personal data are not printed. Investigate nonzero counts only in an access-controlled session; never paste raw production logs into chat or tickets.

```bash
pm2 logs "$PM2_NAME" --lines 100 --nostream | grep -Eic 'error|warn|exception' || true
sudo tail -n 200 /var/log/nginx/error.log | grep -Eic 'error|crit|alert' || true
sudo tail -n 200 /var/log/nginx/access.log | grep -Eic ' 5[0-9][0-9] ' || true
```

## Rollback

Roll back immediately if any backup, migration, build, PM2, header, redirect, collection, webhook, or download check fails. Do not repair production in place. Keep the failed persistent directory for forensic review and restore the pre-release revision and data snapshot.

```bash
cd /var/www/dj-vault-v2
APP_DIR=/var/www/dj-vault-v2
PM2_NAME=dj-vault
BACKUP_DIR=/var/backups/dj-vault/<confirmed-timestamp>
PREVIOUS_REVISION="$(cat "$BACKUP_DIR/git-revision.txt")"

test -f "$BACKUP_DIR/.env"
test -n "$PREVIOUS_REVISION"
pm2 stop "$PM2_NAME"

git checkout --detach "$PREVIOUS_REVISION"
cp --preserve=mode,timestamps "$BACKUP_DIR/.env" "$APP_DIR/.env"

RESTORED_DATA_DIRECTORY="$(sed -n 's/^DATA_DIRECTORY=//p' "$APP_DIR/.env" | tail -n 1)"
if test -f "$BACKUP_DIR/database-directory.tar.gz"; then
  test -n "$RESTORED_DATA_DIRECTORY"
  if test -e "$RESTORED_DATA_DIRECTORY"; then
    sudo mv "$RESTORED_DATA_DIRECTORY" "${RESTORED_DATA_DIRECTORY}.failed-$STAMP"
  fi
  sudo tar -C "$(dirname "$RESTORED_DATA_DIRECTORY")" -xzf "$BACKUP_DIR/database-directory.tar.gz"
fi

if test -f "$BACKUP_DIR/legacy-dot-data.tar.gz"; then
  tar -tzf "$BACKUP_DIR/legacy-dot-data.tar.gz" > /dev/null
fi

npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs --only "$PM2_NAME" --update-env
pm2 status "$PM2_NAME"
```

The original `$APP_DIR/.data` is never written during deployment or rollback. Its backup remains available and is checked for readability; restoring the prior `.env` and Git revision returns the older release to the original JSON source. If a pre-existing persistent directory was backed up, rollback moves the failed one aside rather than deleting it, then restores the archive.

Preserve `$BACKUP_DIR`, record only non-sensitive failure output, and obtain a new explicit approval before attempting the release again.
