<?php

declare(strict_types=1);

namespace App\Pob\GameData;

/**
 * The rune / soul-core catalogue keyed by display name (GGPK soul-core stats).
 */
final class RuneCatalog
{
    /**
     * @var array<string, array{levelRequirement: ?int, effects: list<string>}>|null
     */
    private ?array $runeIndex = null;

    public function __construct(private readonly GameDataStore $store) {}

    /**
     * Every rune entry keyed by display name, for callers that scan the whole
     * catalogue (the reference-picker search).
     *
     * @return array<string, array{levelRequirement: ?int, effects: list<string>}>
     */
    public function all(): array
    {
        return $this->runes();
    }

    /**
     * Granted stats for a rune (level requirement + effect lines), or null if unknown.
     *
     * @return array{levelRequirement: ?int, effects: list<string>}|null
     */
    public function data(?string $name): ?array
    {
        if ($name === null || $name === '') {
            return null;
        }

        return $this->runes()[$name] ?? null;
    }

    /**
     * @return array<string, array{levelRequirement: ?int, effects: list<string>}>
     */
    private function runes(): array
    {
        return $this->runeIndex ??= $this->store->remembered('runes', function (): array {
            /** @var array<string, array{levelRequirement: ?int, effects: list<string>}> $decoded */
            $decoded = $this->store->load('ggpk/runes.json');

            return $decoded;
        });
    }
}
