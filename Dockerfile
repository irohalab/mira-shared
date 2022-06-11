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

# create a release
ENV RELEASE = mira-shared-e2e@$RELEASE_VERSION;
RUN sentry-cli releases new $RELEASE
RUN sentry-cli releases set-commits --auto $RELEASE

# upload sourcemaps
RUN sentry-cli releases files $RELEASE upload-sourcemaps --ext ts --ext map /app/dist

# finalize release
RUN sentry-cli releases finalize $RELEASE
