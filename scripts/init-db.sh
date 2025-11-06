#!/bin/sh

echo "🔄 Initializing database..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 5

# Push schema to database (creates tables if not exist)
echo "📝 Creating database schema..."
npx prisma db push --skip-generate

if [ $? -eq 0 ]; then
  echo "✅ Database schema created successfully"

  # Check if data exists
  echo "🔍 Checking if data exists..."
  npx prisma db execute --stdin <<EOF
SELECT COUNT(*) FROM "Block";
EOF

  if [ $? -ne 0 ]; then
    echo "📦 Running seed data..."
    npx tsx prisma/seed.ts
  else
    echo "✅ Database already has data"
  fi
else
  echo "❌ Failed to create database schema"
  exit 1
fi

echo "✅ Database initialization complete"