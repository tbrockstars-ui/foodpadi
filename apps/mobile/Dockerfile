# FoodPadi mobile app — Expo **web** export, served as a static single-page site.
#
# This is NOT a native build. It runs the React Native app in a browser via
# react-native-web, so people can try FoodPadi without installing an APK. The
# real device builds still go through EAS (`eas build`).
#
# Build context MUST be the repo root (this is an npm-workspaces monorepo; the
# app depends on the @foodpadi/shared package). On Railway: leave the service
# Root Directory empty / "/", set Dockerfile Path to "apps/mobile/Dockerfile".
# By hand:  docker build -f apps/mobile/Dockerfile -t foodpadi-mobile-web .

# ---- build ---------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app
ENV CI=1

# Manifests first so the install layer caches until a package.json / lockfile
# changes. All workspace manifests are copied so `npm ci` can resolve the tree.
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --workspaces --include-workspace-root || npm install --workspaces --include-workspace-root

COPY . .
# @foodpadi/shared is consumed as a compiled package (main: dist/index.js).
RUN npm run shared:build
# Static web bundle -> apps/mobile/dist (SPA; see app.json "web": {"output": "single"}).
RUN cd apps/mobile && npx --yes expo export --platform web --output-dir dist

# ---- runtime -----------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/apps/mobile/dist ./dist
# Railway/any PaaS injects PORT; fall back to 3000 for local `docker run`.
ENV PORT=3000
EXPOSE 3000
# -s: serve index.html for unknown paths so client-side navigation works.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
