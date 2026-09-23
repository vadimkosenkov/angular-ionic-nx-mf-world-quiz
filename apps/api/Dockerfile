# The API as a container image. Built from the repository root:
#   docker build -f apps/api/Dockerfile -t world-quiz-api .
# (CI does this; there is no Docker on the development machine.)
#
# Two stages: the monorepo is only needed to produce `dist/apps/api`, which
# is a single bundled `main.js` plus the SQL migrations and a generated
# package.json listing the few runtime dependencies.

FROM node:24-alpine AS build
WORKDIR /workspace

# Dependencies first: this layer is reused while only sources change.
COPY package.json package-lock.json ./
# The Cypress binary is large and never runs in an image.
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci

COPY . .
RUN npx nx build api --configuration=production --skip-nx-cache

# Only the runtime dependencies of the built bundle.
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY --from=build /workspace/dist/apps/api/package.json ./
COPY --from=build /workspace/dist/apps/api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Listen on every interface: the container's own address is not localhost.
ENV HOST=0.0.0.0
ENV PORT=3333

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /workspace/dist/apps/api ./

# Never run as root; the image contains nothing the app may write to.
USER node
EXPOSE 3333

# The API answers /health once its migrations have run.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "main.js"]
