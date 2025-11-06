# Production Deployment Guide

## 🚨 แก้ปัญหา Database Tables ไม่มีบน Production

### วิธีที่ 1: แก้เฉพาะหน้าบน Server ที่กำลัง Run อยู่

```bash
# SSH เข้า server แล้วไปที่ folder project
cd /path/to/ranking-node

# ดูรายชื่อ containers
docker ps

# วิธี 1.1: Run คำสั่งผ่าน docker-compose
docker-compose -f docker-compose.prod.yml exec webapp sh -c "npx prisma db push --skip-generate"

# วิธี 1.2: หรือ run ผ่าน container name โดยตรง
docker exec [container_name] npx prisma db push --skip-generate

# ถ้าต้องการ seed data
docker-compose -f docker-compose.prod.yml exec webapp sh -c "npx tsx prisma/seed.ts"

# Restart webapp
docker-compose -f docker-compose.prod.yml restart webapp
```

### วิธีที่ 2: Deploy ใหม่ด้วย Auto-Migration (แนะนำ)

1. **Pull code ใหม่ที่มี entrypoint script**
```bash
git pull origin main
```

2. **Build และ deploy ใหม่**
```bash
# Stop containers ที่เก่า
docker-compose -f docker-compose.prod.yml down

# Build ใหม่
docker-compose -f docker-compose.prod.yml build --no-cache

# Start ใหม่ (จะ run migration อัตโนมัติ)
docker-compose -f docker-compose.prod.yml up -d

# ดู logs
docker-compose -f docker-compose.prod.yml logs -f webapp
```

## 📦 Deployment Steps สำหรับ Server ใหม่

### 1. Clone Repository
```bash
git clone <repository-url>
cd ranking-node
```

### 2. Create Environment File
```bash
cp .env.example .env
# แก้ไข .env ตามความเหมาะสม
```

### 3. Deploy with Docker Compose
```bash
# Build และ start services
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment
```bash
# Check health
curl http://localhost:3000/api/health

# Check if tables exist
docker-compose -f docker-compose.prod.yml exec postgres psql -U relay_user -d relay_db -c "\dt"
```

## 🔧 Troubleshooting

### Problem: Tables don't exist
```bash
# Create tables manually
docker-compose -f docker-compose.prod.yml exec webapp npx prisma db push
```

### Problem: Can't connect to database
```bash
# Check if postgres is running
docker-compose -f docker-compose.prod.yml ps

# Check postgres logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec webapp npx prisma db execute --stdin <<< "SELECT 1;"
```

### Problem: Prisma binary error
```bash
# Regenerate Prisma client
docker-compose -f docker-compose.prod.yml exec webapp npx prisma generate
```

## 📝 Useful Commands

### View all tables in database
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U relay_user -d relay_db -c "\dt"
```

### View data in tables
```bash
# View blocks
docker-compose -f docker-compose.prod.yml exec postgres psql -U relay_user -d relay_db -c "SELECT * FROM \"Block\" LIMIT 5;"

# View relay details
docker-compose -f docker-compose.prod.yml exec postgres psql -U relay_user -d relay_db -c "SELECT * FROM \"RelayDetail\" LIMIT 5;"
```

### Reset database (CAUTION!)
```bash
# Drop all tables
docker-compose -f docker-compose.prod.yml exec webapp npx prisma db push --force-reset

# Seed with sample data
docker-compose -f docker-compose.prod.yml exec webapp npx tsx prisma/seed.ts
```

### Update application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Or rebuild without cache
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 🚀 Quick Fix Script

Save this as `fix-db.sh` on your server:

```bash
#!/bin/bash
echo "🔧 Fixing database tables..."
docker-compose -f docker-compose.prod.yml exec webapp npx prisma db push --skip-generate
echo "✅ Database fixed!"
echo "🔄 Restarting webapp..."
docker-compose -f docker-compose.prod.yml restart webapp
echo "✅ Done!"
```

Run with:
```bash
chmod +x fix-db.sh
./fix-db.sh
```