# dev 모드 frontend — Vite 개발 서버 (HMR). 소스는 compose에서 ./frontend 바인드 마운트.
FROM node:22-slim

ARG UID=1000

WORKDIR /app

# 의존성 레이어 캐시 — package 파일만 먼저 복사
COPY package.json package-lock.json ./
RUN npm ci

# 나머지 소스 (런타임엔 bind mount로 덮임. node_modules는 .dockerignore로 제외)
COPY . .

# 익명 볼륨 /app/node_modules 가 이미지에서 시드될 때 컨테이너 실행 uid(1000)가 쓸 수 있도록
RUN chown -R ${UID}:${UID} /app

EXPOSE 3000

# vite.config.js 에서 host:true(0.0.0.0), port:3000 설정 → 호스트에서 :3000 접근 가능
CMD ["npm", "run", "dev"]
