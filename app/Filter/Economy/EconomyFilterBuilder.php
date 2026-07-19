<?php

declare(strict_types=1);

namespace App\Filter\Economy;

use App\Economy\PriceBook;
use App\Filter\Conditions;
use App\Filter\Custom\CustomFilterResult;
use App\Filter\FilterBlock;
use App\Filter\Operator;
use App\Filter\Rarity;
use App\Filter\StyleTheme;
use App\Pob\IconResolver;

/**
 * Turns a league's {@see PriceBook} into the app's economy highlights: valuable currency
 * (and other stackables) and uniques, tiered by price, with the dearest tiers shouting
 * loudest. These blocks are prepended above the vendored NeverSink filter as overrides, so
 * live prices decide what stands out; the {@see StyleTheme} they are given renders them in
 * NeverSink's own visual language.
 *
 * Blocks are emitted dearest-tier-first. Currency keys on its own base type; a unique keys
 * on the base it drops on and carries `Rarity Unique`, since the game can only match a
 * unique by its base and that base may also exist as a plain rare.
 */
final readonly class EconomyFilterBuilder
{
    public function __construct(private PriceTierPolicy $policy, private IconResolver $items) {}

    /**
     * The economy blocks (currency then uniques) as a plain list, so a caller can compose
     * them with other layers (e.g. a build-aware overlay) into one document. Strictness does
     * not enter here: every priced drop is always highlighted, its price tier only deciding
     * how loud it looks. Hiding low-value clutter is the baseline's job, not the highlight's.
     *
     * Currency and uniques can be styled from different themes (they map to different NeverSink
     * tiers); when no separate unique theme is given, currency's is used for both.
     *
     * Base types hidden by the player's Custom picks ({@see CustomFilterResult::hidesBaseType})
     * are left out entirely: that pick beats any price - highlighting them here would re-show
     * what the body below just hid.
     *
     * @return list<FilterBlock>
     */
    public function blocks(PriceBook $book, StyleTheme $theme, ?StyleTheme $uniqueTheme = null, ?CustomFilterResult $custom = null): array
    {
        return [
            ...$this->currencyBlocks($book, $theme, $custom),
            ...$this->uniqueBlocks($book, $uniqueTheme ?? $theme, $custom),
        ];
    }

    /**
     * Currency blocks, tiered by value and aware of stack size. Each currency is surfaced at
     * its per-unit tier, and - when it stacks - also promoted to any dearer tier a full-enough
     * stack of it would reach (`StackSize >= n`). So a stack of ten Exalted lights up louder
     * than a single one. Promotion blocks for a tier are emitted before the plain per-unit
     * blocks and largest-stack-first, so the biggest stacks match their highest tier first
     * (the game takes the first matching block).
     *
     * @return list<FilterBlock>
     */
    private function currencyBlocks(PriceBook $book, StyleTheme $theme, ?CustomFilterResult $custom = null): array
    {
        $tierCount = $this->policy->tierCount();

        // tier => set of base types priced there per unit.
        $unitByTier = [];
        // tier => stack threshold => set of base types promoted to that tier at that stack.
        $stackByTier = [];

        foreach ($book->items('currency') as $item) {
            if ($item->price <= 0.0 || $custom?->hidesBaseType($item->baseType) === true || ! $this->items->knowsBaseType($item->baseType)) {
                continue;
            }

            $unitTier = $this->policy->tierOf($item->price);

            if ($unitTier !== null) {
                $unitByTier[$unitTier][$item->baseType] = true;
            }

            // Promote to dearer tiers a full stack would reach, if the item stacks that far.
            $maxStack = $item->maxStackSize;

            if ($maxStack === null || $maxStack < 2) {
                continue;
            }

            $dearerThanUnit = $unitTier ?? ($tierCount + 1);

            for ($tier = 1; $tier < $dearerThanUnit && $tier <= $tierCount; $tier++) {
                $needed = (int) ceil($this->policy->floorFor($tier) / $item->price);

                if ($needed >= 2 && $needed <= $maxStack) {
                    $stackByTier[$tier][$needed][$item->baseType] = true;
                }
            }
        }

        $blocks = [];

        for ($tier = 1; $tier <= $tierCount; $tier++) {
            $stacks = $stackByTier[$tier] ?? [];
            krsort($stacks); // largest stack requirement first

            foreach ($stacks as $threshold => $set) {
                $baseTypes = array_keys($set);
                sort($baseTypes);

                $blocks[] = FilterBlock::show("currency T{$tier} stack x{$threshold}")
                    ->when(Conditions::stackSize(Operator::AtLeast, $threshold), Conditions::baseType(...$baseTypes))
                    ->style(...$theme->styleFor($tier));
            }

            $unit = array_keys($unitByTier[$tier] ?? []);

            if ($unit !== []) {
                sort($unit);

                $blocks[] = FilterBlock::show("currency T{$tier}")
                    ->when(Conditions::baseType(...$unit))
                    ->style(...$theme->styleFor($tier));
            }
        }

        return $blocks;
    }

    /**
     * One block per non-empty tier for uniques, matched by the base they drop on (valued at
     * the dearest unique sharing that base) and gated to `Rarity Unique`.
     *
     * @return list<FilterBlock>
     */
    private function uniqueBlocks(PriceBook $book, StyleTheme $theme, ?CustomFilterResult $custom = null): array
    {
        $byTier = [];

        foreach ($book->items('unique') as $item) {
            if ($custom?->hidesBaseType($item->baseType) === true || ! $this->items->knowsBaseType($item->baseType)) {
                continue;
            }

            $tier = $this->policy->tierOf($book->baseTypeCeiling($item->baseType) ?? $item->price);

            if ($tier !== null) {
                $byTier[$tier][$item->baseType] = true;
            }
        }

        return $this->blocksFromTiers($byTier, 'unique', true, $theme);
    }

    /**
     * Build the per-tier show blocks from a tier => base-type-set map, dearest tier first.
     * Base types are sorted so the output is deterministic.
     *
     * @param  array<int, array<string, bool>>  $byTier
     * @return list<FilterBlock>
     */
    private function blocksFromTiers(array $byTier, string $label, bool $uniqueOnly, StyleTheme $theme): array
    {
        $blocks = [];

        for ($tier = 1; $tier <= $this->policy->tierCount(); $tier++) {
            $baseTypes = array_keys($byTier[$tier] ?? []);

            if ($baseTypes === []) {
                continue;
            }

            sort($baseTypes);

            $block = FilterBlock::show("{$label} T{$tier}");

            if ($uniqueOnly) {
                $block->when(Conditions::rarity(Rarity::Unique));
            }

            $block->when(Conditions::baseType(...$baseTypes))->style(...$theme->styleFor($tier));

            $blocks[] = $block;
        }

        return $blocks;
    }
}
