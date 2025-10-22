# Build frontend assets
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web ./
RUN npm run build

# Build backend
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
COPY server/package-lock.json ./
RUN npm install
COPY server ./
RUN npm run build

# Production image
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
COPY server/package-lock.json ./
RUN npm install --omit=dev
COPY --from=server-builder /app/server/dist ./dist
COPY --from=web-builder /app/web/dist ./public
EXPOSE 3001
CMD ["node", "dist/index.js"]
