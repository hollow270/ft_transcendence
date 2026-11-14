FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "scripts/start-dev.sh"]
