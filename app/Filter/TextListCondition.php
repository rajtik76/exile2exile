<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A condition matching against one or more quoted string values, e.g.
 * `Class == "Boots" "Gloves"` or `BaseType == "Sapphire Ring"`. The game reads the list
 * as "is any of". Item base and class names never contain a double quote, so wrapping in
 * quotes is all the escaping needed (apostrophes like "Hellion's" sit fine inside them).
 */
final readonly class TextListCondition implements Condition
{
    /** @var list<string> */
    private array $values;

    public function __construct(
        private string $keyword,
        private Operator $operator,
        string ...$values,
    ) {
        if ($values === []) {
            throw new InvalidArgumentException("{$keyword} needs at least one value.");
        }

        $this->values = array_values($values);
    }

    public function render(): string
    {
        $quoted = implode(' ', array_map(static fn (string $value): string => '"'.$value.'"', $this->values));

        return "{$this->keyword} {$this->operator->separator()}{$quoted}";
    }
}
