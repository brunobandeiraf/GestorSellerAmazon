FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src/

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
