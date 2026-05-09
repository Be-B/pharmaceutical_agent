FROM node:20-slim

# node:20-slim 베이스 이미지에 이미 UID 1000인 'node' 유저가 존재 → 재사용
WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package.json ./
RUN npm install

COPY --chown=node:node . .

EXPOSE 3000

# Production: replace with "next build && next start"
CMD ["npm", "run", "dev"]
