# The public SSR site as a container image. Built from the repository root:
#   docker build -f apps/site/Dockerfile --build-arg SITE_URL=… -t world-quiz-site .
#
# The site's home and legal pages are **prerendered at build time**
# (ADR-003), so the environment's URLs and the operator's contact are baked
# into those files: unlike the shell, this image is built once per
# environment (docs/deployment/deploying.md).

FROM node:24-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci

# What the prerendered pages will contain.
ARG SITE_URL
ARG APP_URL
ARG API_URL
ARG SITE_OPERATOR_NAME
ARG SITE_OPERATOR_EMAIL
ENV SITE_URL=$SITE_URL \
    APP_URL=$APP_URL \
    API_URL=$API_URL \
    SITE_OPERATOR_NAME=$SITE_OPERATOR_NAME \
    SITE_OPERATOR_EMAIL=$SITE_OPERATOR_EMAIL

COPY . .
RUN npx nx build site --configuration=production --skip-nx-cache

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4300

# The same values again: pages rendered per request read them at runtime.
ARG SITE_URL
ARG APP_URL
ARG API_URL
ARG SITE_OPERATOR_NAME
ARG SITE_OPERATOR_EMAIL
ENV SITE_URL=$SITE_URL \
    APP_URL=$APP_URL \
    API_URL=$API_URL \
    SITE_OPERATOR_NAME=$SITE_OPERATOR_NAME \
    SITE_OPERATOR_EMAIL=$SITE_OPERATOR_EMAIL

# Angular's SSR server refuses a Host header that is not allowed; the
# deployment sets NG_ALLOWED_HOSTS to the names it is served under.
COPY --from=build /workspace/dist/apps/site ./

USER node
EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4300)+'/en',{headers:{host:'127.0.0.1'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.mjs"]
