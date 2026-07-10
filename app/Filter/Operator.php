<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A comparison operator on a filter condition. {@see Operator::Matches} is the bare
 * form the game reads as "contains / is one of" (e.g. `Rarity Rare`, `Class "Boots"`),
 * written with no operator token at all; the rest are the explicit numeric/exact forms.
 */
enum Operator: string
{
    case Equals = '==';
    case NotEquals = '!=';
    case AtLeast = '>=';
    case AtMost = '<=';
    case MoreThan = '>';
    case LessThan = '<';

    /** The bare, operator-less form - rendered as just the value(s) after the keyword. */
    case Matches = '';

    /**
     * The keyword-to-value separator: the operator token plus a space, or empty for the
     * bare form. Lets a condition render `Keyword op value` and `Keyword value` uniformly.
     */
    public function separator(): string
    {
        return $this === self::Matches ? '' : $this->value.' ';
    }
}
