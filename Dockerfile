FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY web ./web
ENV ZM_DATA=/data ZM_PORT=7373
VOLUME /data
EXPOSE 7373
CMD ["node", "server/cli.js"]
