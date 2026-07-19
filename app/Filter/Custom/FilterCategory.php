<?php

declare(strict_types=1);

namespace App\Filter\Custom;

/**
 * User-toggleable loot categories for the "Custom" filter option. Each category names a set
 * of NeverSink blocks via the `$type->... $tier->...` markers NeverSink stamps on every block,
 * so the mapping survives reordering and works across every vendored style and strictness.
 *
 * Only clutter-prone categories are listed. Safety-net blocks (top uniques, dear currency,
 * exotic/exceptional bases, unknown-item catchers) are deliberately not toggleable. A pick is
 * absolute: the economy overlay skips the base types of a hidden category, so live prices
 * never re-show them - only the build overlay (bases and mods the build wants) stays on top.
 */
enum FilterCategory: string
{
    /** How a NeverSink block-header marker is parsed; the single source for every marker read. */
    private const string MARKER_PATTERN = '/\$type->(\S+)(?:\s+\$tier->(\S+))?/';

    case UncutSkillGems = 'uncut-skill-gems';
    case UncutSupportGems = 'uncut-support-gems';
    case UncutSpiritGems = 'uncut-spirit-gems';
    case RunesAndCores = 'runes-and-cores';
    case Jewels = 'jewels';
    case Relics = 'relics';
    case Waystones = 'waystones';
    case TabletsAndFragments = 'tablets-and-fragments';
    case Essences = 'essences';
    case Catalysts = 'catalysts';
    case DistilledEmotions = 'distilled-emotions';
    case Omens = 'omens';
    case LowCurrency = 'low-currency';
    case FlasksAndCharms = 'flasks-and-charms';
    case RareJewellery = 'rare-jewellery';
    case RareGear = 'rare-gear';
    case CraftingBases = 'crafting-bases';
    case LowUniques = 'low-uniques';
    case GoldPiles = 'gold-piles';
    case Leveling = 'leveling';

    public function label(): string
    {
        return match ($this) {
            self::UncutSkillGems => 'Uncut skill gems',
            self::UncutSupportGems => 'Uncut support gems',
            self::UncutSpiritGems => 'Uncut spirit gems',
            self::RunesAndCores => 'Runes & soul cores',
            self::Jewels => 'Jewels',
            self::Relics => 'Relics',
            self::Waystones => 'Waystones',
            self::TabletsAndFragments => 'Tablets, splinters & fragments',
            self::Essences => 'Essences',
            self::Catalysts => 'Catalysts',
            self::DistilledEmotions => 'Distilled emotions',
            self::Omens => 'Omens',
            self::LowCurrency => 'Low-tier currency',
            self::FlasksAndCharms => 'Endgame flasks & charms',
            self::RareJewellery => 'Rare jewellery',
            self::RareGear => 'Rare gear',
            self::CraftingBases => 'Crafting bases & salvagables',
            self::LowUniques => 'Low-tier uniques',
            self::GoldPiles => 'Gold (small & medium piles)',
            self::Leveling => 'Leveling rules',
        };
    }

    /** Whether a NeverSink block marker (`$type->{type} $tier->{tier}`) belongs to this category. */
    public function matches(string $type, string $tier): bool
    {
        return match ($this) {
            self::UncutSkillGems => $type === 'gems->uncut' && (str_starts_with($tier, 'skill') || $tier === 'otherskilleg'),
            self::UncutSupportGems => $type === 'gems->uncut' && (str_starts_with($tier, 'support') || $tier === 'othersupporteg'),
            self::UncutSpiritGems => $type === 'gems->uncut' && (str_starts_with($tier, 'spirit') || $tier === 'otherspiriteg'),
            self::RunesAndCores => $type === 'sockets->general',
            self::Jewels => $type === 'jewels->generic',
            self::Relics => $type === 'relics->generic',
            self::Waystones => $type === 'waystones' || $type === 'waystone->hiders',
            self::TabletsAndFragments => in_array($type, ['fragments->generic', 'currency->splinter', 'maplike->special', 'miscmapitemsextra'], true),
            self::Essences => $type === 'currency->essence',
            self::Catalysts => $type === 'currency->catalysts',
            self::DistilledEmotions => $type === 'currency->emotions',
            self::Omens => $type === 'currency->omen',
            self::LowCurrency => $type === 'currency->leveling'
                || ($type === 'currency' && in_array($tier, ['d', 'e', 'supplymagic', 'supplieslow'], true)),
            self::FlasksAndCharms => $type === 'endgame->flasks' || $type === 'endgame->charms',
            self::RareJewellery => in_array($type, ['endgame->jewellery', 'rr->jewellery', 'rr->jewelleryeg'], true),
            self::RareGear => $type === 'rr',
            self::CraftingBases => str_starts_with($type, 'endgame->normalcraft')
                || in_array($type, ['endgame->salvagable', 'rare->salvagable'], true),
            self::LowUniques => $type === 'uniques' && in_array($tier, ['t3', 't3boss', 'hideable'], true),
            // Allowlisted small (!gold_pilesmall) and medium (!gold_pilemedium) stacks only, so
            // the large and huge pile tiers (stack2/stack3/stackxl*) always stay visible - and
            // a future NeverSink gold tier is not swept into hiding by default.
            self::GoldPiles => $type === 'gold' && in_array($tier, ['any', 'stack1', 'stack1lvl', 'stack2lvl', 'stack3lvl'], true),
            self::Leveling => str_starts_with($type, 'leveling->') || $type === 'decorators->leveling->magic',
        };
    }

    /**
     * The `[type, tier]` of a block-header marker, or null when the line carries none. The
     * single marker-parsing entry point, so the transformer and availableIn() cannot drift.
     *
     * @return array{string, string}|null
     */
    public static function parseMarker(string $line): ?array
    {
        if (preg_match(self::MARKER_PATTERN, $line, $marker) !== 1) {
            return null;
        }

        return [$marker[1], $marker[2] ?? ''];
    }

    /**
     * The categories that still have at least one visible (`Show`) block in a vendored filter
     * body. Stricter NeverSink levels drop or pre-hide whole sections, so a category absent
     * here has nothing left to toggle at that level.
     *
     * @return list<self>
     */
    public static function availableIn(string $body): array
    {
        preg_match_all('/^Show\b.*$/m', $body, $headers);

        $markers = array_values(array_filter(array_map(self::parseMarker(...), $headers[0])));

        return array_values(array_filter(
            self::cases(),
            static fn (self $category): bool => array_any(
                $markers,
                static fn (array $marker): bool => $category->matches($marker[0], $marker[1]),
            ),
        ));
    }
}
