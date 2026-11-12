<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Pob\Uniques\VariantSelection;
use App\Services\ArchivedCatalogues;

/**
 * Maps the gear of a plan from a finished game era onto the live catalogues and reports what changed.
 *
 * @phpstan-type Dropped array{kind: string, name: string, phases: list<string>}
 * @phpstan-type Changed array{kind: string, name: string, before: string, after: string, phases: list<string>}
 * @phpstan-type GearReport array{removed: list<Dropped>, changed: list<Changed>}
 */
final class PlanConversion
{
    /** @var array<string, Dropped> */
    private array $removed = [];

    /** @var array<string, Changed> */
    private array $changed = [];

    public function __construct(
        private readonly ArchivedCatalogues $from,
        private readonly IconResolver $icons,
        private readonly ModCatalogue $mods,
    ) {}

    /**
     * @param  array<string, mixed>  $data  a normalised plan
     * @return array{data: array<string, mixed>, report: GearReport}
     */
    public function convert(array $data): array
    {
        $labels = [];

        foreach (is_array($data['tabs'] ?? null) ? $data['tabs'] : [] as $tab) {
            if (is_array($tab) && is_string($tab['id'] ?? null) && is_string($tab['label'] ?? null)) {
                $labels[$tab['id']] = $tab['label'];
            }
        }

        $sections = is_array($data['sections'] ?? null) ? $data['sections'] : [];

        foreach ($sections as $key => $section) {
            if (! is_array($section)) {
                continue;
            }

            $sections[$key] = $this->convertSection($section, $this->phaseOf((string) $key, $data['mode'] ?? null, $labels));
        }

        $data['sections'] = $sections;

        return [
            'data' => PlanSchema::canonicalize($data),
            'report' => ['removed' => array_values($this->removed), 'changed' => array_values($this->changed)],
        ];
    }

    /**
     * The hidden set of the other mode is converted too, but never reported.
     *
     * @param  array<string, string>  $labels
     */
    private function phaseOf(string $key, mixed $mode, array $labels): ?string
    {
        if ($mode === 'single') {
            return $key === PlanSchema::SINGLE_KEY ? 'Whole build' : null;
        }

        return $labels[$key] ?? null;
    }

    /**
     * @param  array<string, mixed>  $section
     * @return array<string, mixed>
     */
    private function convertSection(array $section, ?string $phase): array
    {
        if (is_array($section['items']['slots'] ?? null)) {
            foreach ($section['items']['slots'] as $slot => $item) {
                $section['items']['slots'][$slot] = is_array($item) ? $this->convertItem($item, $phase) : $item;
            }

            $section['items']['slots'] = array_filter($section['items']['slots'], static fn (mixed $item): bool => $item !== null);
        }

        if (is_array($section['gems']['groups'] ?? null)) {
            foreach ($section['gems']['groups'] as $index => $group) {
                $gems = is_array($group['gems'] ?? null) ? $group['gems'] : [];
                $section['gems']['groups'][$index]['gems'] = array_values(array_filter(
                    $gems,
                    fn (mixed $gem): bool => ! is_array($gem) || $this->keepReference($gem, 'gem', $phase),
                ));
            }
        }

        return $section;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>|null
     */
    private function convertItem(array $item, ?string $phase): ?array
    {
        $base = is_array($item['base'] ?? null) ? $item['base'] : null;

        if ($base !== null && ! $this->keepReference($base, 'item', $phase)) {
            return null;
        }

        $item['sockets'] = array_map(
            fn (mixed $socket): mixed => is_array($socket) && ! $this->keepReference($socket, 'rune', $phase) ? null : $socket,
            is_array($item['sockets'] ?? null) ? $item['sockets'] : [],
        );

        $original = is_array($item['stats'] ?? null) ? array_values($item['stats']) : [];
        $rarity = PlanItemSchema::rarityOf($base, $original);
        $baseId = ($base['type'] ?? null) === 'base' && is_string($base['id'] ?? null) ? $base['id'] : null;
        $stats = [];

        foreach ($original as $stat) {
            $converted = is_array($stat) ? $this->convertMod($stat, $phase) : null;

            if ($converted === null) {
                continue;
            }

            if (! $this->fits($baseId, $rarity, [...$stats, $converted['stat']])) {
                $this->drop('mod', is_string($stat['text'] ?? null) ? $stat['text'] : '', $phase);

                continue;
            }

            $stats[] = $converted['stat'];

            $change = $converted['change'];

            if ($change !== null) {
                $this->change('mod', $change['name'], $change['before'], $change['after'], $phase);
            }
        }

        $item['stats'] = $stats;

        if (($base['type'] ?? null) === 'unique' && is_string($base['id'] ?? null)) {
            $item['uniqueMods'] = $this->convertUniqueMods($base['id'], $item, $phase);
        }

        return $item;
    }

    /**
     * @param  array<string, mixed>  $stat
     * @return array{stat: array<string, mixed>, change: array{name: string, before: string, after: string}|null}|null
     */
    private function convertMod(array $stat, ?string $phase): ?array
    {
        $modId = is_string($stat['modId'] ?? null) ? $stat['modId'] : null;
        $text = is_string($stat['text'] ?? null) ? $stat['text'] : '';

        if ($modId === null) {
            return ['stat' => $stat, 'change' => null];
        }

        $live = $this->mods->resolve($modId);

        if ($live === null) {
            $this->drop('mod', $text, $phase);

            return null;
        }

        $previous = $this->from->mods->resolve($modId);

        $same = static fn (array $mod): array => [$mod['stats'], $mod['rolls'], $mod['tier'], $mod['type'], $mod['families']];

        if ($previous === null || $same($previous) === $same($live)) {
            return ['stat' => $stat, 'change' => null];
        }

        $values = is_array($stat['values'] ?? null) ? array_values($stat['values']) : [];
        $snapshot = $this->mods->modSnapshot($modId, $this->clamp($values, $live['rolls']), '');

        // Only the range moved and the roll still fits it: show the ranges, not two equal lines.
        [$before, $after] = $text === $snapshot['text']
            ? [implode(' / ', $previous['stats']), implode(' / ', $live['stats'])]
            : [$text, $snapshot['text']];

        return ['stat' => $snapshot, 'change' => ['name' => $live['name'] ?: $modId, 'before' => $before, 'after' => $after]];
    }

    /**
     * Mods are added one at a time and kept only while the whole item still passes the
     * save-time rules, so a base or family conflict never blocks saving the copy.
     *
     * @param  list<array<string, mixed>>  $stats
     */
    private function fits(?string $id, string $rarity, array $stats): bool
    {
        if ($id === null) {
            return true;
        }

        return $this->mods->modErrors($rarity, $stats, $this->icons->itemModDomain($id), $this->icons->itemTags($id), $this->icons->itemClass($id)) === [];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return list<mixed>
     */
    private function convertUniqueMods(string $uniqueId, array $item, ?string $phase): array
    {
        $lines = $this->icons->uniqueModLines($uniqueId, VariantSelection::fromArray($item['variant'] ?? null));
        $byKey = [];

        foreach ([...$lines['implicits'], ...$lines['mods']] as $line) {
            $byKey[$line->key] = $line;
        }

        $kept = [];

        foreach (is_array($item['uniqueMods'] ?? null) ? $item['uniqueMods'] : [] as $mod) {
            if (! is_array($mod) || ! is_string($mod['key'] ?? null)) {
                continue;
            }

            $line = $byKey[$mod['key']] ?? null;
            $values = is_array($mod['values'] ?? null) ? array_values($mod['values']) : [];

            if ($line === null || count($values) !== count($line->rolls)) {
                $this->drop('uniqueMod', $mod['key'], $phase);

                continue;
            }

            $clamped = $this->clamp($values, $line->rolls);

            if ($clamped !== $values) {
                $this->change('uniqueMod', $mod['key'], $this->fill($mod['key'], $values), $this->fill($mod['key'], $clamped), $phase);
            }

            $kept[] = ['key' => $mod['key'], 'values' => $clamped];
        }

        return $kept;
    }

    /**
     * @param  array<string, mixed>  $reference
     */
    private function keepReference(array $reference, string $kind, ?string $phase): bool
    {
        $type = is_string($reference['type'] ?? null) ? $reference['type'] : '';
        $id = is_string($reference['id'] ?? null) ? $reference['id'] : '';

        if ($this->icons->resolveReference($type, $id) !== null) {
            return true;
        }

        $this->drop($kind, (string) ($this->from->icons->resolveReference($type, $id)['name'] ?? $id), $phase);

        return false;
    }

    /**
     * A value that is not a number takes its roll's minimum, so every value stays
     * paired with its own roll.
     *
     * @param  list<mixed>  $values
     * @param  list<array{min: int|float, max: int|float}>  $rolls
     * @return list<int|float>
     */
    private function clamp(array $values, array $rolls): array
    {
        $clamped = [];

        foreach ($values as $index => $value) {
            $roll = $rolls[$index] ?? null;

            if (! is_int($value) && ! is_float($value)) {
                if ($roll !== null) {
                    $clamped[] = $roll['min'];
                }

                continue;
            }

            $clamped[] = $roll === null ? $value : max($roll['min'], min($roll['max'], $value));
        }

        return $clamped;
    }

    /**
     * @param  list<mixed>  $values
     */
    private function fill(string $key, array $values): string
    {
        $index = 0;

        return (string) preg_replace_callback('/#/', static function () use ($values, &$index): string {
            $value = $values[$index++] ?? '#';

            return is_scalar($value) ? (string) $value : '#';
        }, $key);
    }

    private function drop(string $kind, string $name, ?string $phase): void
    {
        if ($phase === null) {
            return;
        }

        $key = "{$kind}:{$name}";
        $this->removed[$key] ??= ['kind' => $kind, 'name' => $name, 'phases' => []];

        if (! in_array($phase, $this->removed[$key]['phases'], true)) {
            $this->removed[$key]['phases'][] = $phase;
        }
    }

    private function change(string $kind, string $name, string $before, string $after, ?string $phase): void
    {
        if ($phase === null) {
            return;
        }

        $key = "{$kind}:{$before}:{$after}";
        $this->changed[$key] ??= ['kind' => $kind, 'name' => $name, 'before' => $before, 'after' => $after, 'phases' => []];

        if (! in_array($phase, $this->changed[$key]['phases'], true)) {
            $this->changed[$key]['phases'][] = $phase;
        }
    }
}
