<?php

declare(strict_types=1);

namespace App\Pob\Reference;

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Builds slim node/gem id sets from the bundled game data and caches them. Only
 * the ids are kept (a few hundred KB), never the multi-MB source files, so a
 * cache read is cheap; an in-instance memo avoids re-reading within a request.
 *
 * Cache keys carry the data version (derived from the committed data stamp), so a
 * data refresh rebuilds the sets automatically.
 */
final class LeagueReference implements BuildReference
{
    /** @var array<int, true>|null */
    private ?array $nodes = null;

    /** @var array<string, true>|null */
    private ?array $gems = null;

    public function __construct(
        private readonly Cache $cache,
        private readonly string $dataVersion,
        private readonly string $treeDataPath,
        private readonly string $gemDataPath,
    ) {}

    public function passiveNodeIds(): array
    {
        return $this->nodes ??= $this->cache->rememberForever(
            "ggg.ref.nodes:{$this->dataVersion}",
            fn (): array => $this->buildNodeSet(),
        );
    }

    public function gemIds(): array
    {
        return $this->gems ??= $this->cache->rememberForever(
            "ggg.ref.gems:{$this->dataVersion}",
            fn (): array => $this->buildGemSet(),
        );
    }

    /**
     * @return array<int, true>
     */
    private function buildNodeSet(): array
    {
        $data = $this->readJson($this->treeDataPath);
        $set = [];

        foreach (array_keys($data['nodes'] ?? []) as $id) {
            if (is_numeric($id)) {
                $set[(int) $id] = true;
            }
        }

        return $set;
    }

    /**
     * @return array<string, true>
     */
    private function buildGemSet(): array
    {
        $set = [];

        foreach (array_keys($this->readJson($this->gemDataPath)) as $key) {
            $key = (string) $key;
            $slash = strrpos($key, '/');
            $segment = $slash === false ? $key : substr($key, $slash + 1);
            $set[$segment] = true;
        }

        return $set;
    }

    /**
     * @return array<mixed>
     */
    private function readJson(string $path): array
    {
        if (! is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : [];
    }
}
