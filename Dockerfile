FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY index.html ./
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "server/index.mjs"]
