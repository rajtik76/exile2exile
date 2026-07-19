<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

/**
 * Builds the on-page preview: a small, fixed set of representative drops (one or two per
 * category) run through the real NeverSink filter, so you can see at a glance what a theme and
 * strictness highlights and what it hides. Each sample is matched against the filter with the
 * game's first-match-wins rule in an endgame context; the block it lands on gives its look, or
 * marks it hidden. Only the plate / border / text colours, font size and beam are reported -
 * no minimap glyphs.
 */
final class NeversinkPreviewBuilder
{
    /**
     * The representative drops, chosen to span the categories whose visibility changes with
     * strictness. Each carries just enough item state to match the filter's conditions in an
     * endgame zone (AreaLevel / ItemLevel default to 80).
     *
     * @var list<array{name: string, class: string, rarity: string, attrs?: array<string, int>}>
     */
    private const array SAMPLES = [
        // Currency: the top tiers always shout; the cheap ones drop out as strictness rises.
        ['name' => 'Mirror of Kalandra', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Divine Orb', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Exalted Orb', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Orb of Alchemy', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Orb of Augmentation', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Scroll of Wisdom', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Breach Splinter', 'class' => 'Stackable Currency', 'rarity' => 'Normal'],
        ['name' => 'Gold', 'class' => 'Stackable Currency', 'rarity' => 'Normal', 'attrs' => ['StackSize' => 320]],
        // A common (low-level) uncut gem, a waystone and a unique.
        ['name' => 'Uncut Skill Gem', 'class' => 'Uncut Skill Gems', 'rarity' => 'Normal', 'attrs' => ['GemLevel' => 1]],
        ['name' => 'Waystone', 'class' => 'Waystones', 'rarity' => 'Normal', 'attrs' => ['WaystoneTier' => 15]],
        ['name' => 'Astramentis', 'class' => 'Amulets', 'rarity' => 'Unique'],
        // The same rare base at four unidentified tiers: strictness hides the weaker rolls
        // first, so the ladder empties from the bottom as the level climbs.
        ['name' => 'Gemini Bow (Tier 5)', 'class' => 'Bows', 'rarity' => 'Rare', 'attrs' => ['UnidentifiedItemTier' => 5]],
        ['name' => 'Gemini Bow (Tier 4)', 'class' => 'Bows', 'rarity' => 'Rare', 'attrs' => ['UnidentifiedItemTier' => 4]],
        ['name' => 'Gemini Bow (Tier 3)', 'class' => 'Bows', 'rarity' => 'Rare', 'attrs' => ['UnidentifiedItemTier' => 3]],
        ['name' => 'Gemini Bow (Tier 2)', 'class' => 'Bows', 'rarity' => 'Rare', 'attrs' => ['UnidentifiedItemTier' => 2]],
        // White gear and an endgame flask: hidden early.
        ['name' => 'Long Quarterstaff', 'class' => 'Quarterstaves', 'rarity' => 'Normal', 'attrs' => ['DropLevel' => 12]],
        ['name' => 'Ultimate Life Flask', 'class' => 'Life Flasks', 'rarity' => 'Normal'],
    ];

    /** Rarity ordering for `Rarity <= / >=` comparisons. */
    private const array RARITY_ORDER = ['Normal' => 0, 'Magic' => 1, 'Rare' => 2, 'Unique' => 3];

    /** Styling / action lines - not conditions, so they never block a match. */
    private const array ACTIONS = [
        'SetFontSize', 'SetTextColor', 'SetBorderColor', 'SetBackgroundColor', 'PlayAlertSound',
        'PlayAlertSoundPositional', 'CustomAlertSound', 'CustomAlertSoundOptional', 'PlayEffect',
        'MinimapIcon', 'DisableDropSound', 'EnableDropSound', 'Continue',
    ];

    /** The item state assumed for every sample unless it overrides it (an endgame map drop). */
    private const array DEFAULT_ATTRS = ['AreaLevel' => 80, 'ItemLevel' => 82, 'StackSize' => 1, 'Quality' => 0, 'Sockets' => 0];

    /**
     * @return list<array{name: string, hidden: bool, fontSize: int, text: array{int, int, int}, border: array{int, int, int}|null, background: array{int, int, int}|null, beam: string|null}>
     */
    public function labels(string $body): array
    {
        $blocks = $this->blocks($body);
        $labels = [];

        foreach (self::SAMPLES as $sample) {
            $attrs = [...self::DEFAULT_ATTRS, ...($sample['attrs'] ?? [])];
            $block = $this->resolve($blocks, $sample, $attrs);

            if ($block === null) {
                // No block claimed it: the game shows it in its default style.
                $labels[] = $this->defaultLabel($sample['name'], $sample['rarity']);

                continue;
            }

            if ($block['kind'] === 'Hide') {
                $labels[] = ['name' => $sample['name'], 'hidden' => true, 'fontSize' => 30, 'text' => [150, 150, 150], 'border' => null, 'background' => null, 'beam' => null];

                continue;
            }

            $labels[] = [
                'name' => $sample['name'],
                'hidden' => false,
                'fontSize' => $this->fontSize($block),
                'text' => $this->color($block, 'SetTextColor') ?? $this->defaultText($sample['rarity']),
                'border' => $this->color($block, 'SetBorderColor'),
                'background' => $this->color($block, 'SetBackgroundColor'),
                'beam' => $this->beam($block),
            ];
        }

        return $labels;
    }

    /**
     * Resolve the sample against the filter the way the game does: walk top to bottom, and for
     * each matching block accumulate its styling. A block with `Continue` keeps the item in
     * play for later blocks (so a decorator can tint it, then a hide layer can still catch it);
     * the first matching block WITHOUT `Continue` is terminal and decides Show vs Hide. The
     * returned lines are all matched blocks' lines in order, so the later ones win.
     *
     * @param  list<array{kind: string, comment: string, lines: list<string>}>  $blocks
     * @param  array{name: string, class: string, rarity: string, attrs?: array<string, int>}  $sample
     * @param  array<string, int>  $attrs
     * @return array{kind: string, comment: string, lines: list<string>}|null
     */
    private function resolve(array $blocks, array $sample, array $attrs): ?array
    {
        $lines = [];
        $kind = null;

        foreach ($blocks as $block) {
            if (! $this->matches($block, $sample, $attrs)) {
                continue;
            }

            $lines = [...$lines, ...$block['lines']];
            $kind = $block['kind'];

            if (! in_array('Continue', $block['lines'], true)) {
                break;
            }
        }

        return $kind === null ? null : ['kind' => $kind, 'comment' => '', 'lines' => $lines];
    }

    /**
     * @param  array{kind: string, comment: string, lines: list<string>}  $block
     * @param  array{name: string, class: string, rarity: string, attrs?: array<string, int>}  $sample
     * @param  array<string, int>  $attrs
     */
    private function matches(array $block, array $sample, array $attrs): bool
    {
        foreach ($block['lines'] as $line) {
            if (! $this->conditionHolds($line, $sample, $attrs)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Whether one condition line holds for the sample. Styling / action lines are not
     * conditions and always pass. A condition the sample can't satisfy (an identified-only mod
     * check) fails, so the block is skipped.
     *
     * @param  array{name: string, class: string, rarity: string, attrs?: array<string, int>}  $sample
     * @param  array<string, int>  $attrs
     */
    private function conditionHolds(string $line, array $sample, array $attrs): bool
    {
        [$keyword] = explode(' ', $line, 2) + [''];

        return match ($keyword) {
            'Class' => $this->listHolds($line, $sample['class']),
            'BaseType' => $this->listHolds($line, $sample['name']),
            'Rarity' => $this->rarityHolds($line, $sample['rarity']),
            'AreaLevel', 'ItemLevel', 'DropLevel', 'StackSize', 'Quality', 'Sockets',
            'WaystoneTier', 'UnidentifiedItemTier', 'GemLevel' => $this->numericHolds($line, $keyword, $attrs),
            'Identified' => str_contains($line, 'False'),
            'Corrupted', 'Mirrored', 'AnyEnchantment' => str_contains($line, 'False'),
            // A styling / action line is not a condition, so it never blocks a match. Any other
            // keyword is a condition this sample can't satisfy (TwiceCorrupted, HasExplicitMod,
            // BaseArmour, ...), so the block is skipped rather than wrongly matched.
            default => in_array($keyword, self::ACTIONS, true),
        };
    }

    /** A `Class`/`BaseType` list: `== "a" "b"` needs an exact member; the bare form allows a substring. */
    private function listHolds(string $line, string $value): bool
    {
        $exact = str_contains($line, '==');
        preg_match_all('/"([^"]+)"/', $line, $m);

        return array_any($m[1], fn ($entry) => $exact ? $entry === $value : str_contains($value, (string) $entry));
    }

    private function rarityHolds(string $line, string $rarity): bool
    {
        $rank = self::RARITY_ORDER[$rarity];
        $rest = trim(substr($line, strlen('Rarity')));

        if (preg_match('/^(<=|>=|<|>|==|=)\s*([A-Za-z]+)/', $rest, $m) === 1) {
            $target = self::RARITY_ORDER[$m[2]] ?? null;

            if ($target === null) {
                return false;
            }

            return match ($m[1]) {
                '<' => $rank < $target,
                '<=' => $rank <= $target,
                '>' => $rank > $target,
                '>=' => $rank >= $target,
                default => $rank === $target,
            };
        }

        return in_array($rarity, preg_split('/\s+/', $rest) ?: [], true);
    }

    /** @param array<string, int> $attrs */
    private function numericHolds(string $line, string $keyword, array $attrs): bool
    {
        if (preg_match('/^\w+\s*(<=|>=|<|>|==|=)?\s*(\d+)/', $line, $m) !== 1) {
            return true;
        }

        $value = $attrs[$keyword] ?? 0;
        $target = (int) $m[2];

        return match ($m[1]) {
            '<' => $value < $target,
            '<=' => $value <= $target,
            '>' => $value > $target,
            // Bare/no-operator means "equals" in the filter grammar (NeverSink writes
            // per-value ladders), not "at least" - only an explicit >= is at-least.
            '', '==', '=' => $value === $target,
            default => $value >= $target,
        };
    }

    /**
     * @return array{name: string, hidden: bool, fontSize: int, text: array{int, int, int}, border: array{int, int, int}|null, background: array{int, int, int}|null, beam: string|null}
     */
    private function defaultLabel(string $name, string $rarity): array
    {
        return ['name' => $name, 'hidden' => false, 'fontSize' => 32, 'text' => $this->defaultText($rarity), 'border' => null, 'background' => null, 'beam' => null];
    }

    /**
     * The game's default name colour for a rarity, used when no block restyles the drop.
     *
     * @return array{int, int, int}
     */
    private function defaultText(string $rarity): array
    {
        return match ($rarity) {
            'Magic' => [136, 136, 255],
            'Rare' => [255, 255, 119],
            'Unique' => [175, 96, 37],
            default => [200, 200, 200],
        };
    }

    /**
     * Split the body into blocks, each with its kind, comment and following lines.
     *
     * @return list<array{kind: string, comment: string, lines: list<string>}>
     */
    private function blocks(string $body): array
    {
        $blocks = [];
        $current = null;

        foreach (explode("\n", $body) as $line) {
            if (NeversinkStyleExtractor::isBlockHeader($line)) {
                if ($current !== null) {
                    $blocks[] = $current;
                }

                $hash = strpos($line, '#');
                $current = [
                    'kind' => str_starts_with($line, 'Show') ? 'Show' : 'Hide',
                    'comment' => $hash === false ? '' : trim(substr($line, $hash + 1)),
                    'lines' => [],
                ];

                continue;
            }

            if ($current !== null && trim($line) !== '' && ! str_starts_with(ltrim($line), '#')) {
                $current['lines'][] = trim($line);
            }
        }

        if ($current !== null) {
            $blocks[] = $current;
        }

        return $blocks;
    }

    /**
     * The colour set by the last matching line for a keyword (later `Continue` blocks override
     * earlier ones), or null if never set.
     *
     * @param  array{kind: string, comment: string, lines: list<string>}  $block
     * @return array{int, int, int}|null
     */
    private function color(array $block, string $keyword): ?array
    {
        $found = null;

        foreach ($block['lines'] as $line) {
            if (str_starts_with($line, $keyword) && preg_match('/(\d+)\s+(\d+)\s+(\d+)/', $line, $m) === 1) {
                $found = [(int) $m[1], (int) $m[2], (int) $m[3]];
            }
        }

        return $found;
    }

    /** @param array{kind: string, comment: string, lines: list<string>} $block */
    private function fontSize(array $block): int
    {
        $size = 32;

        foreach ($block['lines'] as $line) {
            if (str_starts_with($line, 'SetFontSize') && preg_match('/(\d+)/', $line, $m) === 1) {
                $size = (int) $m[1];
            }
        }

        return $size;
    }

    /** @param array{kind: string, comment: string, lines: list<string>} $block */
    private function beam(array $block): ?string
    {
        $beam = null;

        foreach ($block['lines'] as $line) {
            if (str_starts_with($line, 'PlayEffect') && preg_match('/PlayEffect\s+([A-Za-z]+)/', $line, $m) === 1) {
                $beam = $m[1];
            }
        }

        return $beam;
    }
}
