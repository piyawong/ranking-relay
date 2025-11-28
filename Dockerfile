# Dependencies
FROM node:20-alpine AS deps
# Install OpenSSL and other required libraries
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on package files
# Copy only package files first for better caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --prefer-offline --no-audit

# Builder
FROM node:20-alpine AS builder
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only necessary files for build
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY socket-server.js ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY .eslintrc.json ./

# Generate Prisma Client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install OpenSSL for runtime
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Copy Prisma client binaries
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy socket server
COPY --from=builder /app/socket-server.js ./socket-server.js
# Copy lib directory for socket server dependencies
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000 3001

ENV PORT 3000
ENV SOCKET_PORT 3001
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "node socket-server.js & node server.js"]