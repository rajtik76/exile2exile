<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * An item's PoB variant model and the rule for which of its lines apply to a given pick.
 *
 * A port of PathOfBuilding-PoE2's `Classes/Item.lua`: the `Variant:`, `Version:`,
 * `Has Alt Variant[ Two..Five]` and `Selected ...` specs it reads in ParseRaw, the variant
 * groups it builds from `{group:}` tags, `NormaliseVariantSelections` plus the alt-variant
 * defaults in BuildModList (the default picks), and `CheckModLineVariant` (whether a line
 * applies). PoB is the reference here: a unique's mod lines carry `{variant:}`,
 * `{version:}` and `{group:}` tags, and only the lines active for the item's picks are its
 * real mods. An exported PoB item keeps every tagged line plus its own picks, so the same
 * model filters an imported item too.
 *
 * Two modes, as in PoB: an item with a `Version:` list or variant groups uses the
 * versioned/grouped rules; anything else uses the classic main + alt variant rules.
 */
final readonly class PobItemVariants
{
    private const array ALT_SLOT_SUFFIXES = [1 => '', 2 => ' Two', 3 => ' Three', 4 => ' Four', 5 => ' Five'];

    /**
     * @param  list<string>  $variants  `Variant:` names, id = index + 1
     * @param  list<string>  $versions  `Version:` names, id = index + 1
     * @param  list<int>  $altSlots  enabled alt slots (1 = `Has Alt Variant`, 2 = `Two`, ...)
     * @param  array<int, array<int, list<int>>>  $groups  group id => variant id => eligible version ids (0 = every version)
     */
    public function __construct(
        public array $variants,
        public array $versions,
        public array $altSlots,
        public array $groups,
        public VariantSelection $defaults,
    ) {}

    /**
     * Build the model from an item's raw text lines (a unique's PoB data block, or an
     * exported item). Null when the item has neither variants nor versions.
     *
     * @param  list<string>  $lines
     */
    public static function fromItemLines(array $lines): ?self
    {
        $variants = [];
        $versions = [];
        $altSlots = [];
        $variant = null;
        $version = null;
        $alts = [];
        $groupPicks = [];
        $tagged = [];

        foreach ($lines as $line) {
            if (str_contains($line, '{')) {
                $tagged[] = TaggedLine::parse($line);

                continue;
            }

            if (! preg_match('/^([A-Za-z ]+): (.+)$/', trim($line), $spec)) {
                continue;
            }

            [, $name, $value] = $spec;

            match (true) {
                $name === 'Variant' => $variants[] = trim($value),
                $name === 'Version' => $versions[] = trim($value),
                $name === 'Selected Variant' => $variant = self::number($value),
                $name === 'Selected Version' => $version = self::number($value),
                $name === 'Selected Variant Group' => self::addGroupPick($groupPicks, $value),
                default => self::readAltSpec($name, $value, $altSlots, $alts),
            };
        }

        if ($variants === [] && $versions === []) {
            return null;
        }

        $groups = self::buildGroups($tagged, count($variants), count($versions));
        sort($altSlots);

        $model = new self($variants, $versions, array_values(array_unique($altSlots)), $groups, new VariantSelection);

        return new self(
            $model->variants,
            $model->versions,
            $model->altSlots,
            $model->groups,
            $model->normalise(new VariantSelection($variant, $alts, $version, $groupPicks)),
        );
    }

    /**
     * Rebuild a model stored with {@see toArray}.
     *
     * @param  array{variants?: list<string>, versions?: list<string>, altSlots?: list<int>, groups?: array<int|string, array<int|string, list<int>>>, defaults?: array<string, mixed>}  $data
     */
    public static function fromArray(array $data): self
    {
        $groups = [];

        foreach ($data['groups'] ?? [] as $groupId => $byVariant) {
            foreach ($byVariant as $variantId => $versionIds) {
                $groups[(int) $groupId][(int) $variantId] = array_map(intval(...), $versionIds);
            }
        }

        return new self(
            $data['variants'] ?? [],
            $data['versions'] ?? [],
            array_map(intval(...), $data['altSlots'] ?? []),
            $groups,
            VariantSelection::fromArray($data['defaults'] ?? []),
        );
    }

    /**
     * @return array{variants: list<string>, versions: list<string>, altSlots: list<int>, groups: array<int, array<int, list<int>>>, defaults: array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}}
     */
    public function toArray(): array
    {
        return [
            'variants' => $this->variants,
            'versions' => $this->versions,
            'altSlots' => $this->altSlots,
            'groups' => $this->groups,
            'defaults' => $this->defaults->toArray(),
        ];
    }

    /**
     * A valid pick for this item: every axis clamped into range, and anything missing
     * filled with PoB's default. Mirrors `NormaliseVariantSelections` (versioned/grouped)
     * and the alt-variant defaults in BuildModList (classic); a missing pick is the last
     * variant/version, as in PoB.
     */
    public function normalise(?VariantSelection $selection = null): VariantSelection
    {
        $selection ??= $this->defaults;
        $variantCount = count($this->variants);

        if (! $this->usesVersionedOrGroupedVariants()) {
            $alts = [];

            foreach ($this->altSlots as $slot) {
                $alts[$slot] = self::clamp($selection->alts[$slot] ?? $this->defaults->alts[$slot] ?? $variantCount, $variantCount);
            }

            return new VariantSelection(
                variant: $variantCount > 0 ? self::clamp($selection->variant ?? $this->defaults->variant ?? $variantCount, $variantCount) : null,
                alts: $alts,
            );
        }

        $versionCount = count($this->versions);
        $version = $versionCount > 0 ? self::clamp($selection->version ?? $this->defaults->version ?? $versionCount, $versionCount) : null;
        $variant = $this->hasIndependentVariants()
            ? self::clamp($selection->variant ?? $this->defaults->variant ?? $variantCount, $variantCount)
            : null;

        return new VariantSelection(
            variant: $variant,
            version: $version,
            groups: $this->normaliseGroups($selection->groups !== [] ? $selection->groups : $this->defaults->groups, $version),
        );
    }

    /**
     * Whether a line applies to the (normalised) pick - PoB's `CheckModLineVariant`.
     */
    public function isActive(TaggedLine $line, VariantSelection $selection): bool
    {
        if ($this->usesVersionedOrGroupedVariants()) {
            if ($line->versions !== null && ($selection->version === null || ! in_array($selection->version, $line->versions, true))) {
                return false;
            }

            if ($line->groups !== null) {
                if ($line->variants === null) {
                    return false;
                }

                foreach ($line->groups as $groupId) {
                    $picked = $selection->groups[$groupId] ?? null;

                    if ($picked !== null && in_array($picked, $line->variants, true)) {
                        return true;
                    }
                }

                return false;
            }

            if ($this->hasIndependentVariants() && $line->variants !== null) {
                return $selection->variant !== null && in_array($selection->variant, $line->variants, true);
            }

            return $line->variants === null;
        }

        if ($line->variants === null) {
            return true;
        }

        return array_any([$selection->variant, ...array_values($selection->alts)], fn ($picked) => $picked !== null && in_array($picked, $line->variants, true));
    }

    /**
     * The variant ids a group can pick under the given version - PoB's
     * `GetVariantGroupOptions` without the "already used by another group" exclusion.
     *
     * @return list<int>
     */
    public function groupOptions(int $groupId, ?int $version): array
    {
        $options = [];

        foreach ($this->groups[$groupId] ?? [] as $variantId => $versionIds) {
            if (in_array(0, $versionIds, true) || ($version !== null && in_array($version, $versionIds, true))) {
                $options[] = $variantId;
            }
        }

        sort($options);

        return $options;
    }

    public function usesVersionedOrGroupedVariants(): bool
    {
        return $this->versions !== [] || $this->groups !== [];
    }

    public function hasIndependentVariants(): bool
    {
        return $this->versions !== [] && $this->variants !== [] && $this->groups === [];
    }

    /**
     * PoB's group pass in `NormaliseVariantSelections`: a still-valid pick that no other
     * group already holds is kept, then every remaining group takes its first eligible
     * variant nobody uses yet.
     *
     * @param  array<int, int>  $picks
     * @return array<int, int>
     */
    private function normaliseGroups(array $picks, ?int $version): array
    {
        $groupIds = array_keys($this->groups);
        sort($groupIds);

        $used = [];
        $selected = [];
        $needsSelection = [];

        foreach ($groupIds as $groupId) {
            $options = $this->groupOptions($groupId, $version);

            if ($options === []) {
                continue;
            }

            $pick = $picks[$groupId] ?? null;

            if ($pick !== null && in_array($pick, $options, true) && ! isset($used[$pick])) {
                $used[$pick] = true;
                $selected[$groupId] = $pick;
            } else {
                $needsSelection[] = $groupId;
            }
        }

        foreach ($needsSelection as $groupId) {
            foreach ($this->groupOptions($groupId, $version) as $variantId) {
                if (! isset($used[$variantId])) {
                    $selected[$groupId] = $variantId;
                    $used[$variantId] = true;
                    break;
                }
            }
        }

        ksort($selected);

        return $selected;
    }

    /**
     * Group id => variant id => eligible versions, from the `{group:}` tagged lines; a
     * grouped line without a `{version:}` tag is eligible in every version (0).
     *
     * @param  list<TaggedLine>  $lines
     * @return array<int, array<int, list<int>>>
     */
    private static function buildGroups(array $lines, int $variantCount, int $versionCount): array
    {
        $groups = [];

        foreach ($lines as $line) {
            if ($line->groups === null || $line->variants === null) {
                continue;
            }

            foreach ($line->groups as $groupId) {
                foreach ($line->variants as $variantId) {
                    if ($variantId < 1 || $variantId > $variantCount) {
                        continue;
                    }

                    $versionIds = $line->versions === null
                        ? [0]
                        : array_filter($line->versions, static fn (int $id): bool => $id >= 1 && $id <= $versionCount);

                    $groups[$groupId][$variantId] = array_values(array_unique([...$groups[$groupId][$variantId] ?? [], ...$versionIds]));
                }
            }
        }

        ksort($groups);

        foreach ($groups as &$byVariant) {
            ksort($byVariant);
        }

        return $groups;
    }

    /**
     * @param  list<int>  $altSlots
     * @param  array<int, int>  $alts
     */
    private static function readAltSpec(string $name, string $value, array &$altSlots, array &$alts): null
    {
        foreach (self::ALT_SLOT_SUFFIXES as $slot => $suffix) {
            if ($name === 'Has Alt Variant'.$suffix && trim($value) === 'true') {
                $altSlots[] = $slot;
            } elseif ($name === 'Selected Alt Variant'.$suffix && ($picked = self::number($value)) !== null) {
                $alts[$slot] = $picked;
            }
        }

        return null;
    }

    /**
     * @param  array<int, int>  $picks
     */
    private static function addGroupPick(array &$picks, string $value): null
    {
        if (preg_match('/^(\d+)\s*=\s*(\d+)$/', trim($value), $match)) {
            $picks[(int) $match[1]] = (int) $match[2];
        }

        return null;
    }

    private static function number(string $value): ?int
    {
        return preg_match('/^[+-]?\d+/', trim($value), $match) ? (int) $match[0] : null;
    }

    private static function clamp(int $value, int $count): int
    {
        return max(1, min($count, $value));
    }
}
