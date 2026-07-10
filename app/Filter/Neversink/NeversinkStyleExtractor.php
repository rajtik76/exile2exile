<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

use App\Filter\Action;
use App\Filter\Actions;

/**
 * Pulls the exact styling lines out of a NeverSink filter body so the app's override blocks
 * can reuse them. NeverSink tags every block with a `$type->... $tier->...` marker in its
 * comment; given a marker, this returns the block's styling actions (colours, font, sound,
 * beam, minimap icon) verbatim - so an overridden drop is styled 1:1 like NeverSink would.
 */
final class NeversinkStyleExtractor
{
    /** The action keywords that make up a block's styling (everything that is not a condition). */
    private const string ACTION_PATTERN = '/^(SetFontSize|SetTextColor|SetBorderColor|SetBackgroundColor|PlayAlertSound|PlayAlertSoundPositional|CustomAlertSound|CustomAlertSoundOptional|PlayEffect|MinimapIcon|DisableDropSound|EnableDropSound)\b/';

    /** @var list<string> */
    private array $lines;

    public function __construct(string $body)
    {
        $this->lines = explode("\n", $body);
    }

    /**
     * The styling actions of the first block whose header carries the given marker (e.g.
     * `$type->currency $tier->s`). Empty when no such block exists.
     *
     * @return list<Action>
     */
    public function style(string $marker): array
    {
        foreach ($this->lines as $index => $line) {
            // Anchored so a marker isn't matched as the prefix of a longer one - the
            // "…$tier->t3" marker must not match a "…$tier->t3boss" header. Require the
            // char right after the marker to be a non-word boundary (space / EOL / "!").
            if (! $this->isBlockHeader($line) || preg_match('/'.preg_quote($marker, '/').'(?!\S)/', $line) !== 1) {
                continue;
            }

            return $this->actionsAfter($index);
        }

        return [];
    }

    /**
     * The first non-empty styling found among the markers, in order. Lets a caller fall back
     * from a specific tier to a broader one when a strictness level dropped the specific block.
     *
     * @param  list<string>  $markers
     * @return list<Action>
     */
    public function firstStyle(array $markers): array
    {
        foreach ($markers as $marker) {
            $style = $this->style($marker);

            if ($style !== []) {
                return $style;
            }
        }

        return [];
    }

    private function isBlockHeader(string $line): bool
    {
        return str_starts_with($line, 'Show') || str_starts_with($line, 'Hide');
    }

    /**
     * Collect the styling lines of the block starting at the header on $headerIndex, skipping
     * its condition lines and stopping at the blank line that ends the block.
     *
     * @return list<Action>
     */
    private function actionsAfter(int $headerIndex): array
    {
        $actions = [];

        for ($index = $headerIndex + 1; $index < count($this->lines); $index++) {
            $line = $this->lines[$index];
            $trimmed = ltrim($line);

            // A blank line or the next block header ends this block.
            if (trim($line) === '' || $this->isBlockHeader($line)) {
                break;
            }

            if (preg_match(self::ACTION_PATTERN, $trimmed) === 1) {
                $actions[] = Actions::raw($trimmed);
            }
        }

        return $actions;
    }
}
