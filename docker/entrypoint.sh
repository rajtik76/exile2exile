#!/bin/sh
set -e

# The container filesystem is fresh on every deploy, so the game-data paths
# have to be pointed at the persistent release store again.
php artisan poe2:link-game-data --force

# The environment only exists at run time, so the caches are built here rather
# than during the image build.
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Build the derived game-data indices so no web request has to. A failure here
# must never block the boot.
php artisan poe2:warm-game-data || true

# Everything above runs as root, while php-fpm, the scheduler and the queue
# worker run as www-data. The volume also still holds files written as root
# from before the switch to this image.
chown -R www-data:www-data storage bootstrap/cache

exec "$@"
