#!/bin/sh

echo "🔄 Initializing database..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in 1 2 3 4 5; do
  if echo "SELECT 1;" | node_modules/.bin/prisma db execute --stdin 2>/dev/null; then
    echo "✅ Database is ready"
    break
  fi
  echo "⏳ Waiting for database... ($i/5)"
  sleep 3
done

# Push schema to database (creates tables if not exist)
echo "📝 Applying database schema..."
node_modules/.bin/prisma db push --skip-generate

if [ $? -eq 0 ]; then
  echo "✅ Database schema applied successfully"
else
  echo "❌ Failed to apply database schema - trying alternative method..."
  # Try without skip-generate flag
  node_modules/.bin/prisma db push --accept-data-loss
  if [ $? -eq 0 ]; then
    echo "✅ Database schema applied with alternative method"
  else
    echo "⚠️ Could not apply schema automatically. Please run manually."
  fi
fi

echo "🚀 Starting application..."
node server.js