FROM node:17 AS base
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
# install sentry-cli
RUN npm install -g @sentry/cli
WORKDIR /app

FROM base AS dev
COPY package.json /app/package.json
COPY yarn.lock /app/yarn.lock
RUN yarn
COPY . /app/

FROM dev AS prod
RUN npm run build:e2e

ENV HOME=/app
ARG RELEASE_VERSION
# create a release
RUN sentry-cli releases new $RELEASE_VERSION
RUN sentry-cli releases set-commits --auto $RELEASE_VERSION

# upload sourcemaps
RUN sentry-cli releases files $RELEASE_VERSION upload-sourcemaps --ext ts --ext map /app/dist --url-prefix 'app:///' --validate

# finalize release
RUN sentry-cli releases finalize $RELEASE_VERSION
