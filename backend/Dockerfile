FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
# The existing lock omits an optional transitive MongoDB peer; legacy peer
# handling keeps the install deterministic without changing runtime dependencies.
RUN npm ci --omit=dev --legacy-peer-deps
COPY . .
EXPOSE 5001
USER node
CMD ["node", "src/app.js"]
