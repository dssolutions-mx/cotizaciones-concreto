# Docker Recovery Guide for Beginners

## What is Docker?

Docker lets us run a database on your computer without installing PostgreSQL directly. We'll use it to search for the deleted order.

## Step-by-Step Instructions

### Step 1: Install Docker (if not already installed)

#### On macOS:
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Install the `.dmg` file
3. Open Docker Desktop from Applications
4. Wait for Docker to start (whale icon in menu bar should be steady)

#### Verify Docker is installed:
```bash
docker --version
```
You should see something like: `Docker version 24.x.x`

### Step 2: Start Docker Desktop

1. Open Docker Desktop application
2. Wait until it says "Docker Desktop is running" (green status)
3. The whale icon in your menu bar should be steady (not animating)

### Step 3: Open Terminal

1. Open Terminal (Applications → Utilities → Terminal)
2. Navigate to your project:
   ```bash
   cd /Users/juanj/cotizador-dc/cotizaciones-concreto
   ```

### Step 4: Get Your Database Connection String

1. Go to: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg
2. Click on **Project Settings** (gear icon on left sidebar)
3. Click on **Database** in the settings menu
4. Scroll down to **Connection string**
5. Click on **URI** tab
6. Copy the connection string (it looks like):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
7. **Important**: Replace `[password]` with your actual database password
   - You can find/reset password in: Project Settings → Database → Database password

### Step 5: Run the Recovery Script

```bash
./scripts/recover-ORD-20260128-7243-docker.sh
```

When prompted, paste your connection string and press Enter.

### Step 6: Wait for Results

The script will:
1. Start a local database container (takes ~10 seconds)
2. Search production database for order traces
3. Show progress messages
4. Save results to `recovery-exports/` folder

### Step 7: Check Results

```bash
# List all recovery files
ls -la recovery-exports/

# View the traces file
cat recovery-exports/order-traces-*.txt

# View extracted order (if found)
cat recovery-exports/extracted-order-*.json
```

## What's Happening Behind the Scenes

1. **Docker Compose** starts a PostgreSQL database on your computer (port 5433)
2. **Docker containers** run PostgreSQL commands to search the production database
3. **Results** are saved to your `recovery-exports/` folder
4. **No changes** are made to production - we're only reading/searching

## Common Issues and Solutions

### Issue: "Docker command not found"
**Solution**: Docker is not installed or not in PATH
- Install Docker Desktop (see Step 1)
- Make sure Docker Desktop is running

### Issue: "Cannot connect to Docker daemon"
**Solution**: Docker Desktop is not running
- Open Docker Desktop application
- Wait for it to fully start
- Try again

### Issue: "Permission denied" when running script
**Solution**: Script needs execute permission
```bash
chmod +x scripts/recover-ORD-20260128-7243-docker.sh
```

### Issue: "Connection refused" or database connection error
**Solution**: Check your connection string
- Make sure you replaced `[password]` with actual password
- Verify connection string format is correct
- Check if IP whitelisting is needed in Supabase Dashboard

### Issue: "Port 5433 already in use"
**Solution**: Another container is using that port
```bash
# Stop existing containers
docker-compose -f docker/recovery-docker-compose.yml down

# Or use a different port (edit docker-compose.yml)
```

## Alternative: Manual Docker Commands

If the script doesn't work, you can run commands manually:

### 1. Start Recovery Database
```bash
docker-compose -f docker/recovery-docker-compose.yml up -d
```

### 2. Wait for Database to be Ready
```bash
# Check if database is ready (should return "accepting connections")
docker exec order-recovery-db pg_isready -U postgres
```

### 3. Search for Order Traces
```bash
# Replace <connection_string> with your actual connection string
docker run --rm -i postgres:15 psql "<connection_string>" -f scripts/find-order-ORD-20260128-7243.sql > recovery-exports/traces.txt
```

### 4. View Results
```bash
cat recovery-exports/traces.txt
```

### 5. Stop Containers When Done
```bash
docker-compose -f docker/recovery-docker-compose.yml down
```

## Understanding Docker Commands

- `docker-compose up -d` - Start containers in background
- `docker-compose down` - Stop and remove containers
- `docker ps` - List running containers
- `docker logs <container-name>` - View container logs
- `docker exec <container-name> <command>` - Run command in container

## Visual Guide

```
Your Computer                    Supabase (Cloud)
┌─────────────┐                 ┌──────────────┐
│             │                 │              │
│  Docker     │  ────search───> │  Production │
│  Container  │                 │  Database   │
│             │ <───results──── │              │
│             │                 └──────────────┘
│  Saves to   │
│  recovery-  │
│  exports/   │
└─────────────┘
```

## Quick Reference

```bash
# 1. Make sure Docker is running
docker ps

# 2. Navigate to project
cd /Users/juanj/cotizador-dc/cotizaciones-concreto

# 3. Run recovery script
./scripts/recover-ORD-20260128-7243-docker.sh

# 4. Check results
ls recovery-exports/

# 5. Clean up when done
docker-compose -f docker/recovery-docker-compose.yml down
```

## Need Help?

If you get stuck:
1. Check Docker Desktop is running (whale icon steady)
2. Verify connection string is correct
3. Check error messages in terminal
4. Review `recovery-exports/` folder for any output files

## Next Steps After Recovery

Once you have results:
1. Review `recovery-exports/order-traces-*.txt` for order_id
2. If order_id found, reconstruct order from traces
3. Export recovered data as evidence
4. Document the recovery process
