FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_LIVE_WS_URL=/api/events/ws
ARG VITE_HISTORY_API_URL=/api/history/events
ENV VITE_LIVE_WS_URL=${VITE_LIVE_WS_URL}
ENV VITE_HISTORY_API_URL=${VITE_HISTORY_API_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_UPSTREAM=backend:8090
EXPOSE 80
