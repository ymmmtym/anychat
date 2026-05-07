FROM oven/bun:1.3.13-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN bun install --production

FROM oven/bun:1.3.13-alpine

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs public ./public

USER nodejs

EXPOSE 3000

CMD ["bun", "run", "server.js"]
