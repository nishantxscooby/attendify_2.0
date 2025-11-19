FROM node:20-slim

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . ./

EXPOSE 8080

CMD ["node", "server.js"]
