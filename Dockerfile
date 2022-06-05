FROM node:17 AS base
WORKDIR /app

FROM base AS dev
COPY package.json /app/package.json
COPY yarn.lock /app/yarn.lock
RUN yarn
COPY . /app/

FROM dev AS prod
RUN npm run build:e2e

ENV HOME=/app