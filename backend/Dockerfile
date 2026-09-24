FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
# Render builds this service with the repository root as its Docker context.
# Keep dependency installation tied to the backend manifest and lockfile.
COPY backend/package*.json ./
# The existing lock omits an optional transitive MongoDB peer; legacy peer
# handling keeps the install deterministic without changing runtime dependencies.
RUN npm ci --omit=dev --legacy-peer-deps
COPY backend/. .
EXPOSE 5001
USER node
CMD ["node", "src/app.js"]
