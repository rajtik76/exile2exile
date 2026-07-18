<?php

declare(strict_types=1);

namespace App\Filter\Build;

use App\Filter\Conditions;
use App\Filter\FilterBlock;
use App\Filter\Operator;
use App\Filter\Rarity;
use App\Filter\StyleTheme;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;

/**
 * The build-aware overlay: highlights drops that matter for a specific build, read straight
 * from the saved plan. This is what a hand-tuned filter makes the player click - pick your
 * class, mark the mods you want - derived automatically instead.
 *
 * Two things a filter can key on are known from the plan alone, so no game-data guessing is
 * needed: the exact base types the build wears, and the affix names its items carry - read
 * straight off each stat's own frozen `name` snapshot (see
 * {@see ModCatalogue::modSnapshot}), never re-resolved against the live catalogue.
 * From those it emits:
 *  - an identified-item block (`HasExplicitMod`) that lights up anything carrying a mod the
 *    build wants;
 *  - an unidentified-rare block (`UnidentifiedItemTier`) for the base types the build uses,
 *    so potential upgrades stand out.
 */
final readonly class BuildFilterBuilder
{
    public function __construct(private IconResolver $items) {}

    /**
     * @param  array<string, mixed>  $planData  a canonical plan blob
     * @param  int  $unidentifiedFloor  the lowest UnidentifiedItemTier a build-base rare must
     *                                  carry to be highlighted as a potential upgrade
     * @return list<FilterBlock>
     */
    public function blocks(array $planData, StyleTheme $theme, int $unidentifiedFloor = 2): array
    {
        [$baseTypes, $affixes] = $this->collect($planData);

        $blocks = [];

        // Anything identified that carries a mod this build wants.
        if ($affixes !== []) {
            $blocks[] = FilterBlock::show('build: wanted affixes')
                ->when(
                    Conditions::identified(true),
                    Conditions::rarity(Rarity::Normal, Rarity::Magic, Rarity::Rare),
                    Conditions::hasExplicitMod(Operator::AtLeast, 1, ...$affixes),
                )
                ->style(...$theme->styleFor(1));
        }

        // Unidentified rares of the base types the build wears, well-rolled enough to matter.
        if ($baseTypes !== []) {
            $blocks[] = FilterBlock::show('build: base upgrades')
                ->when(
                    Conditions::identified(false),
                    Conditions::rarity(Rarity::Rare),
                    Conditions::baseType(...$baseTypes),
                    Conditions::unidentifiedItemTier(Operator::AtLeast, $unidentifiedFloor),
                )
                ->style(...$theme->styleFor(2));
        }

        return $blocks;
    }

    /**
     * Collect the base types the build wears and the affix names its items carry, across
     * every phase's equipment. Unique items are skipped for bases (they carry no rollable
     * base upgrade); their author mods, and everyone's, feed the affix set.
     *
     * @param  array<string, mixed>  $planData
     * @return array{0: list<string>, 1: list<string>}
     */
    private function collect(array $planData): array
    {
        $baseTypes = [];
        $affixes = [];

        $sections = is_array($planData['sections'] ?? null) ? $planData['sections'] : [];

        foreach ($sections as $section) {
            $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

            foreach ($slots as $slot) {
                $base = is_array($slot['base'] ?? null) ? $slot['base'] : null;

                if ($base !== null && ($base['type'] ?? null) === 'base' && is_string($base['id'] ?? null) && $base['id'] !== '') {
                    $baseTypes[$base['id']] = true;
                }

                foreach (is_array($slot['stats'] ?? null) ? $slot['stats'] : [] as $stat) {
                    // The name is already frozen on the stat itself (see
                    // ModCatalogue::modSnapshot) - null on a plain-text (unmatched) line,
                    // which carries no affix name to key a filter on anyway.
                    $name = is_array($stat) && is_string($stat['name'] ?? null) ? $stat['name'] : '';

                    if ($name !== '') {
                        $affixes[$name] = true;
                    }
                }
            }
        }

        // Only reference bases the game actually knows: one unknown `BaseType` rule makes
        // the game reject the whole filter, so drop anything not in the GGPK base list.
        $baseTypes = $this->items->keepKnownBaseTypes(array_keys($baseTypes));
        $affixNames = array_keys($affixes);
        sort($baseTypes);
        sort($affixNames);

        return [$baseTypes, $affixNames];
    }
}
