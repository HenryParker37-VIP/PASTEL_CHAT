FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY backend/. .
EXPOSE 5001
USER node
CMD ["node", "src/app.js"]
