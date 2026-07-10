<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A `HasExplicitMod` condition matching identified items that carry at least (or a
 * compared count of) any of the named affixes, e.g.
 * `HasExplicitMod >=1 "Athlete's" "of the Yeti"`. The count sits directly against the
 * operator (`>=1`), matching the game's grammar. Only meaningful alongside
 * `Identified True` - an unidentified item exposes no mods.
 */
final readonly class ModCondition implements Condition
{
    /** @var list<string> */
    private array $affixes;

    public function __construct(
        private Operator $operator,
        private int $count,
        string ...$affixes,
    ) {
        if ($affixes === []) {
            throw new InvalidArgumentException('HasExplicitMod needs at least one affix name.');
        }

        $this->affixes = array_values($affixes);
    }

    public function render(): string
    {
        $quoted = implode(' ', array_map(static fn (string $affix): string => '"'.$affix.'"', $this->affixes));

        return "HasExplicitMod {$this->operator->value}{$this->count} {$quoted}";
    }
}
