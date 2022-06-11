FROM node:17 AS base
# install sentry-cli
ENV INSTALL_DIR=/usr/bin
RUN curl -sL https://sentry.io/get-cli/ | bash
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
RUN sentry-cli --auth-token $SENTRY_AUTH_TOKEN release new -o $SENTRY_ORG -p $SENTRY_PROJECT $RELEASE
RUN sentry-cli --auth-token $SENTRY_AUTH_TOKEN releases -o $SENTRY_ORG -p $SENTRY_PROJECT set-commits --auto $RELEASE

# upload sourcemaps
RUN sentry-cli --auth-token $SENTRY_AUTH_TOKEN releases -o $SENTRY_ORG -p $SENTRY_PROJECT files $RELEASE upload-sourcemaps --ext ts --ext map /app/dist

# finalize release
RUN sentry-cli --auth-token $SENTRY_AUTH_TOKEN releases -o $SENTRY_ORG -p $SENTRY_PROJECT finalize $RELEASE
