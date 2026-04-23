# Quick Start: Docker Recovery (5 Minutes)

## Prerequisites Check

```bash
# 1. Check if Docker is installed
docker --version

# 2. Check if Docker is running
docker ps
```

If either fails, see "Install Docker" section below.

## Fast Track (Copy & Paste)

### Step 1: Start Docker Desktop
- Open Docker Desktop app
- Wait for green "Running" status

### Step 2: Get Connection String
1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Settings → Database → Connection string → URI
3. Copy the string (replace `[password]` with your actual password)

### Step 3: Run Recovery
```bash
cd /Users/juanj/cotizador-dc/cotizaciones-concreto
./scripts/recover-ORD-20260128-7243-docker.sh
```

Paste connection string when prompted.

### Step 4: Check Results
```bash
ls recovery-exports/
cat recovery-exports/order-traces-*.txt
```

Done! 🎉

---

## Install Docker (if needed)

### macOS:
```bash
# Download and install Docker Desktop
# https://www.docker.com/products/docker-desktop/

# Or use Homebrew:
brew install --cask docker
```

Then open Docker Desktop from Applications.

### Verify Installation:
```bash
docker --version
docker ps
```

---

## Troubleshooting

### "Docker not running"
→ Open Docker Desktop app, wait for it to start

### "Permission denied"
```bash
chmod +x scripts/recover-ORD-20260128-7243-docker.sh
```

### "Connection error"
→ Check connection string, make sure password is correct

### "Port in use"
```bash
docker-compose -f docker/recovery-docker-compose.yml down
```

---

## What Files Are Created?

- `recovery-exports/order-traces-*.txt` - Search results
- `recovery-exports/extracted-order-*.json` - Order data (if found)
- `recovery-backups/production-dump-*.sql` - Database dump (optional)

---

## Clean Up When Done

```bash
# Stop Docker containers
docker-compose -f docker/recovery-docker-compose.yml down

# Remove old files (optional)
rm -rf recovery-exports/* recovery-backups/*
```
