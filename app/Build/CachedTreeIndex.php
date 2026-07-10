<?php

declare(strict_types=1);

namespace App\Build;

use App\Pob\Reference\LeagueReference;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Builds slim name/kind and class-override lookups from the bundled tree data
 * and caches them. Only the fields a summary needs are kept - never the multi-MB
 * geometry - so a cache read is cheap; an in-instance memo avoids re-reading
 * within a request.
 *
 * Cache keys carry the data version (derived from the committed data stamp), so a
 * data refresh rebuilds the lookups automatically. Mirrors {@see LeagueReference}.
 */
final class CachedTreeIndex implements TreeIndex
{
    /** @var array<int, array{name: string, kind: string}>|null */
    private ?array $nodes = null;

    /** @var array<string, array{overrides: array<int, int>, ascendancies: array<string, string>}>|null */
    private ?array $classes = null;

    public function __construct(
        private readonly Cache $cache,
        private readonly string $dataVersion,
        private readonly string $treeDataPath,
    ) {}

    #[\Override]
    public function nodes(): array
    {
        return $this->nodes ??= $this->cache->rememberForever(
            "ggg.tree.nodes:{$this->dataVersion}",
            fn (): array => $this->buildNodes(),
        );
    }

    #[\Override]
    public function classes(): array
    {
        return $this->classes ??= $this->cache->rememberForever(
            "ggg.tree.classes:{$this->dataVersion}",
            fn (): array => $this->buildClasses(),
        );
    }

    /**
     * @return array<int, array{name: string, kind: string}>
     */
    private function buildNodes(): array
    {
        $index = [];

        foreach ($this->readJson($this->treeDataPath)['nodes'] ?? [] as $id => $node) {
            if (! is_numeric($id) || ! is_array($node)) {
                continue;
            }

            $index[(int) $id] = [
                'name' => (string) ($node['name'] ?? ''),
                'kind' => $this->kind($node),
            ];
        }

        return $index;
    }

    /**
     * @return array<string, array{overrides: array<int, int>, ascendancies: array<string, string>}>
     */
    private function buildClasses(): array
    {
        $index = [];

        foreach ($this->readJson($this->treeDataPath)['classes'] ?? [] as $class) {
            if (! is_array($class) || ! isset($class['name'])) {
                continue;
            }

            $overrides = [];
            foreach ($class['overridePairs'] ?? [] as $base => $target) {
                $overrides[(int) $base] = (int) $target;
            }

            $ascendancies = [];
            foreach ($class['ascendancies'] ?? [] as $ascendancy) {
                if (isset($ascendancy['id'], $ascendancy['name'])) {
                    $ascendancies[(string) $ascendancy['id']] = (string) $ascendancy['name'];
                }
            }

            $index[(string) $class['name']] = [
                'overrides' => $overrides,
                'ascendancies' => $ascendancies,
            ];
        }

        return $index;
    }

    /**
     * The renderer keeps a node's kind from its base flags even when a class
     * overrides the label, so we classify by the base node exactly as it does.
     *
     * @param  array<string, mixed>  $node
     */
    private function kind(array $node): string
    {
        return match (true) {
            ! empty($node['isKeystone']) => 'keystone',
            ! empty($node['isNotable']) => 'notable',
            ! empty($node['isMastery']) => 'mastery',
            ! empty($node['isJewelSocket']) => 'jewel',
            ! empty($node['isGenericAttribute']) => 'attribute',
            default => 'small',
        };
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
