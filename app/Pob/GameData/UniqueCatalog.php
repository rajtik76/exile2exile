<?php

declare(strict_types=1);

namespace App\Pob\GameData;

use App\Pob\Uniques\PobItemVariants;
use App\Pob\Uniques\PobUniqueStore;
use App\Pob\Uniques\TaggedLine;
use App\Pob\Uniques\UniqueModLine;
use App\Pob\Uniques\VariantSelection;

/**
 * Unique-item mods synced from Path of Building - the one documented exception to the
 * project's otherwise GGPK-only sourcing, since unique mods aren't in GGG's own data
 * files (see {@see PobUniqueStore}).
 *
 * A unique is addressed by its id: its name, or "Name, Base" for a name PoB has on more
 * than one base (see SyncPobUniques). Its lines carry PoB's variant tags, so which lines
 * are its mods depends on the picked variant ({@see PobItemVariants}).
 */
final class UniqueCatalog
{
    /**
     * @var array<string, array{name: string, base: string, variants: ?PobItemVariants, lines: list<array{line: TaggedLine, implicit: bool}>}>|null
     */
    private ?array $entries = null;

    public function __construct(private readonly ?PobUniqueStore $store = null) {}

    /**
     * Every synced unique, keyed by id. Read straight from {@see PobUniqueStore} rather than
     * through {@see GameDataStore::remembered()}: that cache is keyed by the GGPK data
     * version, but the PoB sync moves on its own daily cadence unrelated to a GGPK patch, so
     * caching this against the data version would keep serving yesterday's mods until the
     * next deploy. The store's own JSON read is cheap enough to just do once per
     * request/instance.
     *
     * @return array<string, array{name: string, base: string, variants: ?PobItemVariants, lines: list<array{line: TaggedLine, implicit: bool}>}>
     */
    public function entries(): array
    {
        if ($this->entries !== null) {
            return $this->entries;
        }

        $snapshot = $this->store?->read();
        $entries = [];

        foreach ($snapshot['uniques'] ?? [] as $id => $unique) {
            $entries[(string) $id] = [
                'name' => $unique['name'],
                'base' => $unique['base'],
                'variants' => is_array($unique['variants'] ?? null) ? PobItemVariants::fromArray($unique['variants']) : null,
                'lines' => self::lines($unique),
            ];
        }

        return $this->entries = $entries;
    }

    /**
     * The ids of the synced uniques named `$name` (several for a name on more than one base).
     *
     * @return list<string>
     */
    public function idsNamed(string $name): array
    {
        $ids = [];

        foreach ($this->entries() as $id => $entry) {
            if ($entry['name'] === $name) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /**
     * The id of the unique an item names, picked by its base when the name alone is
     * ambiguous - PoB's own "Title, BaseName" lookup. Falls back to the name itself when
     * nothing is synced for it, so a GGPK-only unique still resolves by name.
     */
    public function idFor(string $name, ?string $base): string
    {
        $ids = $this->idsNamed($name);

        if (count($ids) <= 1) {
            return $ids[0] ?? $name;
        }

        foreach ($ids as $id) {
            if ($this->entries()[$id]['base'] === $base) {
                return $id;
            }
        }

        return $ids[0];
    }

    /**
     * The unique's display name (the GGPK name its icon and flavour resolve by) - the id
     * itself for a unique with no synced entry.
     */
    public function nameOf(string $id): string
    {
        return $this->entries()[$id]['name'] ?? $id;
    }

    public function variants(string $id): ?PobItemVariants
    {
        return $this->entries()[$id]['variants'] ?? null;
    }

    /**
     * The unique's mod lines for a variant pick (its PoB default when none is given),
     * split into implicit and explicit, in PoB's order.
     *
     * @return array{implicits: list<UniqueModLine>, mods: list<UniqueModLine>}
     */
    public function modLines(string $id, ?VariantSelection $selection = null): array
    {
        $lines = ['implicits' => [], 'mods' => []];
        $entry = $this->entries()[$id] ?? null;

        if ($entry === null) {
            return $lines;
        }

        $variants = $entry['variants'];
        $selection = $variants?->normalise($selection);

        foreach ($entry['lines'] as ['line' => $line, 'implicit' => $implicit]) {
            if ($variants !== null && $selection !== null && ! $variants->isActive($line, $selection)) {
                continue;
            }

            $lines[$implicit ? 'implicits' : 'mods'][] = UniqueModLine::parse($line->text);
        }

        return $lines;
    }

    /**
     * Every line of the unique, each variant's included, with its variant tags - for the
     * planner, which filters them by the item's own pick (resources/js/lib/uniqueVariants.ts).
     *
     * @return list<array{line: UniqueModLine, tags: TaggedLine, implicit: bool}>
     */
    public function taggedModLines(string $id): array
    {
        return array_map(
            static fn (array $entry): array => ['line' => UniqueModLine::parse($entry['line']->text), 'tags' => $entry['line'], 'implicit' => $entry['implicit']],
            $this->entries()[$id]['lines'] ?? [],
        );
    }

    /**
     * A unique's underlying base item (e.g. "Viper Cap" for Constricting Command),
     * synced from Path of Building alongside its mods - .dat itself has no unique-to-
     * base-type link. Null when unsynced or the id isn't a known unique. This is what
     * lets a unique's own defensive stats be looked up via {@see ItemCatalog::armour}
     * despite .dat's gap - the base name it resolves to is a real GGPK base type.
     */
    public function baseType(?string $id): ?string
    {
        if ($id === null || $id === '') {
            return null;
        }

        $base = $this->entries()[$id]['base'] ?? null;

        return is_string($base) && $base !== '' ? $base : null;
    }

    /**
     * A stored entry's lines. A snapshot written before variant tags were kept carries
     * `implicitCount` + untagged `mods` instead; those read as untagged lines until the
     * next daily sync rewrites the snapshot.
     *
     * @param  array<string, mixed>  $unique
     * @return list<array{line: TaggedLine, implicit: bool}>
     */
    private static function lines(array $unique): array
    {
        if (is_array($unique['lines'] ?? null)) {
            return array_map(static fn (array $line): array => [
                'line' => new TaggedLine(
                    (string) $line['text'],
                    isset($line['variants']) ? array_values(array_map(intval(...), $line['variants'])) : null,
                    isset($line['versions']) ? array_values(array_map(intval(...), $line['versions'])) : null,
                    isset($line['groups']) ? array_values(array_map(intval(...), $line['groups'])) : null,
                ),
                'implicit' => (bool) ($line['implicit'] ?? false),
            ], array_values($unique['lines']));
        }

        $implicitCount = (int) ($unique['implicitCount'] ?? 0);

        return array_map(
            static fn (string $text, int $index): array => ['line' => new TaggedLine($text), 'implicit' => $index < $implicitCount],
            array_values($unique['mods'] ?? []),
            array_keys(array_values($unique['mods'] ?? [])),
        );
    }
}
