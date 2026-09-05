FROM node:22-alpine
RUN apk upgrade --no-cache libcrypto3 libssl3
WORKDIR /app
COPY services/notification-service/package*.json ./
RUN npm ci --omit=dev \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --chown=node:node services/shared ./services/shared
COPY --chown=node:node services/notification-service/server.js services/notification-service/email.js ./services/notification-service/
ENV NODE_ENV=production
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "services/notification-service/server.js"]
