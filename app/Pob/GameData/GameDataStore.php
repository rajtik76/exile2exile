<?php

declare(strict_types=1);

namespace App\Pob\GameData;

use Closure;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Shared access to the vendored GGPK-derived data files: JSON loading, icon web-path
 * mapping and the cross-request cache the derived catalogue indices are built into.
 */
final readonly class GameDataStore
{
    /**
     * Public web base for locally vendored icons (mirrors the Art/** tree from the GGPK).
     */
    private const string ICON_WEB_BASE = '/icons/poe2';

    /**
     * Derived-index cache schema. Bump when an index's SHAPE changes (not its data),
     * so a deploy busts caches the old code populated even though the game data - and
     * thus the data version - is unchanged. v2: notables carry a `keystone` flag. v3:
     * gems carry `hoverImage`, plus the new `gem_scaling` index. v4: items carry
     * `armour` (base defensive stats from GGPK `ArmourTypes`/`ShieldTypes`). v5: gems
     * carry `requires` (the level/attribute range, capped at the character level cap,
     * plus the new `gem_requirements` index).
     */
    private const string CACHE_SCHEMA = 'v5';

    /**
     * The derived catalogue indices are built from multi-MB GGPK JSON. When a cache is
     * given (the container binding passes one, keyed by the data version) each index
     * is built once and reused across requests, so a reference search / resolve no
     * longer re-parses the source every time. Container-free callers (unit tests, the
     * import path) pass no cache and simply build in-process.
     */
    public function __construct(
        private ?Cache $cache = null,
        private string $dataVersion = 'dev',
    ) {}

    /**
     * Build a derived index once, caching it across requests (keyed by the data
     * version) when a cache is available; otherwise build in-process every call.
     *
     * @template TValue
     *
     * @param  Closure(): TValue  $build
     * @return TValue
     */
    public function remembered(string $key, Closure $build): mixed
    {
        if ($this->cache === null) {
            return $build();
        }

        return $this->cache->rememberForever("icons.{$key}:{$this->dataVersion}:".self::CACHE_SCHEMA, $build);
    }

    /**
     * Map a GGPK `.dds` art path to the `.png` the extractor actually vendors.
     */
    public function ddsToPng(mixed $dds): ?string
    {
        if (! is_string($dds) || ! str_ends_with($dds, '.dds')) {
            return is_string($dds) ? $dds : null;
        }

        return substr($dds, 0, -4).'.png';
    }

    /**
     * Map an Art/** relative path to its web path, but only if the file is vendored.
     */
    public function webPathIfPresent(?string $relative): ?string
    {
        if ($relative === null) {
            return null;
        }

        return Storage::disk('game-data')->exists('public/icons/poe2/'.$relative)
            ? self::ICON_WEB_BASE.'/'.$relative
            : null;
    }

    /**
     * @return array<array-key, array<string, mixed>>
     */
    public function load(string $file): array
    {
        return $this->loadJson('resources/poe2/'.$file);
    }

    /**
     * Decode a JSON file addressed relative to the project root (unlike {@see load},
     * which is scoped to the vendored `resources/poe2` data dir).
     *
     * @return array<array-key, mixed>
     */
    public function loadJson(string $relative): array
    {
        $disk = Storage::disk('game-data');

        if (! $disk->exists($relative)) {
            return [];
        }

        $decoded = json_decode((string) $disk->get($relative), true);

        return is_array($decoded) ? $decoded : [];
    }
}
