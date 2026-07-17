<?php

declare(strict_types=1);

namespace App\Pob\GameData;

use App\Pob\Uniques\PobUniqueStore;
use App\Pob\Uniques\UniqueModLine;

/**
 * Unique-item mods synced from Path of Building - the one documented exception to the
 * project's otherwise GGPK-only sourcing, since unique mods aren't in GGG's own data
 * files (see {@see PobUniqueStore}).
 */
final class UniqueCatalog
{
    /**
     * @var array<string, array{base: string, implicits: list<string>, mods: list<string>}>|null
     *                                                                                           Unique display name => its base type and implicit/explicit mod lines.
     */
    private ?array $modsIndex = null;

    public function __construct(private readonly ?PobUniqueStore $store = null) {}

    /**
     * Unique display name => its mod lines, split into implicit/explicit by the synced
     * `implicitCount`. Read straight from {@see PobUniqueStore} rather than through
     * {@see GameDataStore::remembered()}: that cache is keyed by the GGPK data version,
     * but the PoB sync moves on its own daily cadence unrelated to a GGPK patch, so
     * caching this against the data version would keep serving yesterday's mods until
     * the next deploy. The store's own JSON read is cheap enough to just do once per
     * request/instance.
     *
     * @return array<string, array{base: string, implicits: list<string>, mods: list<string>}>
     */
    public function mods(): array
    {
        if ($this->modsIndex !== null) {
            return $this->modsIndex;
        }

        $snapshot = $this->store?->read();

        if ($snapshot === null) {
            return $this->modsIndex = [];
        }

        $index = [];

        foreach ($snapshot['uniques'] as $name => $unique) {
            $index[$name] = [
                'base' => $unique['base'],
                'implicits' => array_slice($unique['mods'], 0, $unique['implicitCount']),
                'mods' => array_slice($unique['mods'], $unique['implicitCount']),
            ];
        }

        return $this->modsIndex = $index;
    }

    /**
     * The structured (key/rolls) form of a unique's synced mods, for callers that only need
     * the parsed lines - the plan mapper's import-value matching, the plan request's range
     * validation - without a full reference payload.
     *
     * @return array{implicits: list<UniqueModLine>, mods: list<UniqueModLine>}
     */
    public function modLines(string $name): array
    {
        $mods = $this->mods()[$name] ?? null;

        if ($mods === null) {
            return ['implicits' => [], 'mods' => []];
        }

        return [
            'implicits' => array_map(UniqueModLine::parse(...), $mods['implicits']),
            'mods' => array_map(UniqueModLine::parse(...), $mods['mods']),
        ];
    }

    /**
     * A unique's underlying base item (e.g. "Viper Cap" for Constricting Command),
     * synced from Path of Building alongside its mods - .dat itself has no unique-to-
     * base-type link. Null when unsynced or the name isn't a known unique. This is what
     * lets a unique's own defensive stats be looked up via {@see ItemCatalog::armour}
     * despite .dat's gap - the base name it resolves to is a real GGPK base type.
     */
    public function baseType(?string $name): ?string
    {
        if ($name === null || $name === '') {
            return null;
        }

        $base = $this->mods()[$name]['base'] ?? null;

        return is_string($base) && $base !== '' ? $base : null;
    }
}
