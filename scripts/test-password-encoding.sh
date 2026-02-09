#!/bin/bash
# Test different password encoding methods

PASSWORD="Jj2584410@"
PROJECT_REF="pkjqznogflgbnwzkzmpg"
POOLER_HOST="aws-0-us-east-1.pooler.supabase.com"

echo "Testing different password encodings..."
echo ""

# Method 1: URL encode @ as %40
echo "Method 1: URL encode @ as %40"
CONN1="postgresql://postgres.${PROJECT_REF}:Jj2584410%40@${POOLER_HOST}:6543/postgres"
echo "Connection string: postgresql://postgres.${PROJECT_REF}:Jj2584410%40@${POOLER_HOST}:6543/postgres"
docker run --rm -i postgres:15 psql "$CONN1" -c "SELECT 1;" 2>&1 | head -1
echo ""

# Method 2: Use environment variable (psql handles encoding)
echo "Method 2: Using PGPASSWORD environment variable"
export PGPASSWORD="Jj2584410@"
docker run --rm -i -e PGPASSWORD="$PGPASSWORD" postgres:15 psql "postgresql://postgres.${PROJECT_REF}@${POOLER_HOST}:6543/postgres" -c "SELECT 1;" 2>&1 | head -1
echo ""

# Method 3: Try with quotes around password
echo "Method 3: Check if password has other special characters"
echo "Please verify the exact password from Supabase Dashboard"
echo "Go to: Project Settings → Database → Connection string"
echo "And check what password is shown (it might be masked)"
