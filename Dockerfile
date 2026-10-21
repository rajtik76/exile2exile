# Composer dependencies. This stage runs first because the asset build needs
# vendor/ and a bootable app (see below).
FROM php:8.4-cli-alpine AS vendor

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction

COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

# Frontend assets. Built on top of the vendor stage, not node:*-alpine, because
# the Wayfinder Vite plugin shells out to `php artisan wayfinder:generate` to
# write the typed route helpers the TypeScript imports.
FROM vendor AS assets

RUN apk add --no-cache nodejs npm

ARG VITE_CONTACT_EMAIL

RUN npm ci --no-audit --no-fund && npm run build

# Runtime. No composer and no app node_modules - but node and npm stay: the
# GGPK extractor (tools/poe-data-extract) runs inside this container whenever
# the StageGameData job picks up a new patch.
FROM php:8.4-fpm-alpine AS run

RUN apk add --no-cache nginx supervisor libpq nodejs npm \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql opcache pcntl \
    && apk del .build-deps

# The queue worker runs npm as www-data, which has no writable home.
ENV NPM_CONFIG_CACHE=/tmp/.npm

COPY docker/php.ini /usr/local/etc/php/conf.d/app.ini
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-app.conf
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

WORKDIR /app

COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

# Installed here rather than in a build stage so the native sharp binary
# matches this image's libc. The extractor has no committed lockfile, so this
# is the same `npm install` refresh.mjs runs before each extraction, which is
# then a quick no-op.
RUN npm install --prefix tools/poe-data-extract --no-audit --no-fund

# The extractor writes its config, CDN cache and output next to its sources,
# and the game-data paths under public/ and resources/ are symlinked into the
# persistent volume by the entrypoint. Bootstrap caches are dropped so the
# entrypoint rebuilds them for this environment.
RUN rm -f bootstrap/cache/*.php \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache public/tree public/icons resources/poe2 \
    && chown -R www-data:www-data storage bootstrap/cache tools/poe-data-extract

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/up >/dev/null 2>&1 || exit 1

ENTRYPOINT ["entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
