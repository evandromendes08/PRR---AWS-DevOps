FROM node:22-alpine
WORKDIR /app
COPY services/registration-service/package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node services/shared ./services/shared
COPY --chown=node:node services/registration-service/server.js ./services/registration-service/server.js
ENV NODE_ENV=production
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "services/registration-service/server.js"]
