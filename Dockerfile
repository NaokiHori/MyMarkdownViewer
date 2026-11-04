FROM node:26-alpine AS base

RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app

COPY --chown=node:node server/package.json server/package-lock.json ./

# development image: all dependencies and sources; runs checks and tests
FROM base AS dev
# --ignore-scripts: never run install scripts of dependencies (a common supply chain attack vector)
RUN npm ci --ignore-scripts
COPY --chown=node:node server/tsconfig.json ./
COPY --chown=node:node server/src src
COPY --chown=node:node web web

# runtime dependencies only (katex, marked: pure JavaScript, so independent of the libc)
FROM base AS deps
# the native tsc binary is an optional dependency, which --omit=dev does not skip;
# the npm cache is kept out of the layer
RUN npm ci --omit=dev --ignore-scripts --cache /tmp/npm-cache && rm -rf node_modules/@typescript /tmp/npm-cache

# release image: distroless Node (no shell, no package manager), non-root
FROM gcr.io/distroless/nodejs26-debian13:nonroot AS release
WORKDIR /app
COPY --from=deps --chown=65532:65532 /app/node_modules node_modules
COPY --chown=65532:65532 server/package.json ./
COPY --chown=65532:65532 server/src src
COPY --chown=65532:65532 web web
EXPOSE 8080
# the entrypoint is already node
CMD ["src/server.ts"]
