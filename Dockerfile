FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server/ ./server/
COPY dist/client/ ./dist/client/
ENV PORT=4000
EXPOSE 4000
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
