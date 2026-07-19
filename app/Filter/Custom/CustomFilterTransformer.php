<?php

declare(strict_types=1);

namespace App\Filter\Custom;

use App\Filter\Neversink\NeversinkStyleExtractor;

/**
 * Applies the player's "Custom" category picks to a vendored NeverSink body: every block whose
 * NeverSink marker falls in a disabled category is flipped from `Show` to `Hide` and stripped
 * of its alert actions (sound, beam, minimap icon), so the item neither renders nor pings.
 * Nothing is deleted or reordered - block conditions and the rest of the file stay verbatim,
 * so the game's first-match-wins evaluation is unchanged for everything still enabled.
 */
final readonly class CustomFilterTransformer
{
    /** Alert actions that make sense on a visible drop only; removed from blocks turned to Hide. */
    private const array ALERT_ACTIONS = ['PlayAlertSound', 'PlayAlertSoundPositional', 'CustomAlertSound', 'PlayEffect', 'MinimapIcon'];

    /**
     * Returns the transformed body, the picks that actually flipped a block (in the order
     * given, so banners and file names report only hides that really happened) and the base
     * types the muted blocks matched on - all from the same single scan of the body.
     *
     * @param  list<FilterCategory>  $disabled
     */
    public function apply(string $body, array $disabled): CustomFilterResult
    {
        if ($disabled === []) {
            return new CustomFilterResult($body, [], [], []);
        }

        $lines = explode("\n", $body);
        $muting = false;
        $applied = [];
        $exactNames = [];
        $substringNames = [];

        foreach ($lines as $index => $line) {
            if (NeversinkStyleExtractor::isBlockHeader($line)) {
                $matched = str_starts_with($line, 'Show') ? $this->disabledFor($line, $disabled) : null;
                $muting = $matched !== null;

                if ($matched !== null) {
                    $lines[$index] = 'Hide'.substr($line, strlen('Show'));

                    if (! in_array($matched, $applied, true)) {
                        $applied[] = $matched;
                    }
                }

                continue;
            }

            if (! $muting) {
                continue;
            }

            if ($this->isAlertAction($line)) {
                unset($lines[$index]);

                continue;
            }

            $trimmed = ltrim($line);

            if (str_starts_with($trimmed, 'BaseType') && preg_match_all('/"([^"]+)"/', $line, $names) > 0) {
                // Mirror the game's BaseType semantics: `BaseType == ...` matches the exact
                // name, a bare `BaseType ...` matches any name containing it (which is how
                // one muted "Uncut Support Gem" line covers every per-level variant).
                if (preg_match('/^BaseType\s*==/', $trimmed) === 1) {
                    $exactNames += array_fill_keys($names[1], true);
                } else {
                    $substringNames += array_fill_keys($names[1], true);
                }
            }
        }

        $order = array_flip(array_column($disabled, 'value'));
        usort($applied, static fn (FilterCategory $a, FilterCategory $b): int => $order[$a->value] <=> $order[$b->value]);

        return new CustomFilterResult(implode("\n", $lines), $applied, array_keys($exactNames), array_keys($substringNames));
    }

    /**
     * The first disabled category the block header's marker falls into, or null when it is
     * not affected.
     *
     * @param  list<FilterCategory>  $disabled
     */
    private function disabledFor(string $blockHeader, array $disabled): ?FilterCategory
    {
        $marker = FilterCategory::parseMarker($blockHeader);

        if ($marker === null) {
            return null;
        }

        return array_find(
            $disabled,
            static fn (FilterCategory $category): bool => $category->matches($marker[0], $marker[1]),
        );
    }

    private function isAlertAction(string $line): bool
    {
        $trimmed = ltrim($line);

        return array_any(self::ALERT_ACTIONS, static fn (string $action): bool => str_starts_with($trimmed, $action));
    }
}
