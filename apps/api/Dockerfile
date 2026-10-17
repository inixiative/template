FROM oven/bun:1.4.2

RUN apt-get update -y && apt-get install -y openssl

RUN bun add -g @biomejs/biome

WORKDIR /app

COPY package.json bun.lockb* bun.lock* ./
RUN bun install

CMD ["bun", "run", "--watch", "src/app/index.ts"]
