# FoodPadi API (NestJS) — container image for Render / Fly / any Docker host.
#
# Build context MUST be the repo root (this is a monorepo; the API depends on
# the @foodpadi/shared workspace package). On Render this is `dockerContext: .`
# in render.yaml; by hand: `docker build -f apps/api/Dockerfile .`

# ---- base -------------------------------------------------------------------
FROM node:20-slim AS base
WORKDIR /app
# Prisma's query engine needs OpenSSL at runtime on Debian slim images.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV CI=true

# ---- dependencies ----------------------------------------------------------
# Install against the workspace root so npm resolves every workspace. Only the
# manifests are copied first, so this layer is cached until a package.json or
# the lockfile changes.
FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# `npm ci` is preferred (reproducible); fall back to `npm install` if the
# lockfile is briefly out of sync with the manifests.
RUN npm ci --workspaces --include-workspace-root || npm install --workspaces --include-workspace-root

# ---- build ---------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
# @foodpadi/shared is consumed as a compiled package (main: dist/index.js).
RUN npm run shared:build
# Generate the Prisma client into node_modules before compiling.
RUN npx --yes prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run api:build

# ---- runtime -----------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# node_modules carries the generated Prisma client (.prisma/client) produced
# in the build stage. devDependencies are kept so `prisma migrate deploy` can
# run at startup — fine for now; prune later if image size matters.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api
# Render/Fly inject PORT; main.ts reads it (defaults to 3000 otherwise).
EXPOSE 4310
# Apply any pending migrations, then start. `migrate deploy` is a no-op when
# the DB is already up to date, so it's safe on every restart.
CMD ["sh", "-c", "npx --yes prisma migrate deploy --schema prisma/schema.prisma && node dist/main"]
