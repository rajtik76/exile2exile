<?php

declare(strict_types=1);

namespace App\Pob;

/**
 * Per-level skill gem requirements, derived from GGPK data into
 * resources/poe2/ggpk/gem_requirements.json (see tools/poe-data-extract).
 *
 * Keyed by canonical gem id (the last Metadata segment, matching {@see PobImport}),
 * each gem maps a gem level to the character level and Str/Dex/Int it requires -
 * the curve the diff engine uses to gate whether a character can run a gem. The
 * attribute curve is computed via PoB's getGemStatRequirement formula.
 */
final class GemRequirements
{
    /**
     * @param  array<string, array{name: string, levels: array<int, array{requiredLevel: int, str: int, dex: int, int: int}>}>|null  $data  Inject a fixed dataset (tests); null loads the vendored file lazily.
     */
    public function __construct(private ?array $data = null) {}

    /**
     * The requirement a gem imposes at a given level, or null when we have no
     * data for that gem/level pair.
     *
     * @return array{requiredLevel: int, str: int, dex: int, int: int}|null
     */
    public function at(string $gemId, int $level): ?array
    {
        return $this->data()[$gemId]['levels'][$level] ?? null;
    }

    /**
     * @return array<string, array{name: string, levels: array<int, array{requiredLevel: int, str: int, dex: int, int: int}>}>
     */
    private function data(): array
    {
        if ($this->data !== null) {
            return $this->data;
        }

        $path = dirname(__DIR__, 2).'/resources/poe2/ggpk/gem_requirements.json';

        if (! is_file($path)) {
            return $this->data = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return $this->data = is_array($decoded) ? $decoded : [];
    }
}
