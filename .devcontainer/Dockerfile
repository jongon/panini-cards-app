ARG WWWUSER=1000
ARG WWWGROUP=1000

FROM node:24-bookworm-slim AS base
WORKDIR /var/www/html
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=/home/node/.local/share/pnpm/bin:${PATH}
ENV pnpm_config_store_dir=/var/www/html/node_modules/.pnpm-store
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates jq \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

FROM base AS devcontainer
USER node
ENV PATH="/home/node/.local/bin:${PATH}"
CMD ["sleep", "infinity"]

FROM base AS app
ARG WWWUSER
ARG WWWGROUP
COPY --chown=${WWWUSER}:${WWWGROUP} package.json pnpm-lock.yaml* ./
USER ${WWWUSER}
CMD ["pnpm", "dev", "--inspect=0.0.0.0:9229"]

FROM base AS pnpm
ARG WWWUSER
ARG WWWGROUP
COPY --chown=${WWWUSER}:${WWWGROUP} package.json pnpm-lock.yaml* ./
USER ${WWWUSER}
CMD ["pnpm", "i"]