FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

# --- OCI Labels Setup ---
# Bu degerler build komutundan --build-arg ile gelecek
ARG BUILD_DATE
ARG VERSION
ARG VCS_REF

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.authors="Treabet" \
      org.opencontainers.image.url="https://github.com/treabet/nobetmatik_clinic" \
      org.opencontainers.image.documentation="https://github.com/treabet/nobetmatik_clinic/blob/main/README.md" \
      org.opencontainers.image.source="https://github.com/treabet/nobetmatik_clinic" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.vendor="Treabet" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Nobetmatik Clinic" \
      org.opencontainers.image.description="Klinik nobet ve vardiya takip sistemi" \
      org.opencontainers.image.base.name="nginx:alpine"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]