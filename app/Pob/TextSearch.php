<?php

declare(strict_types=1);

namespace App\Pob;

/**
 * Shared prefix-word search over display text, used by the build-planner catalogues.
 *
 * A query is split into lowercase terms; text matches when every term prefixes some
 * word in it - so "lig res" matches "Lightning Resistance". Word boundaries are any
 * run of non-letter/non-digit characters, so placeholders and punctuation split too.
 */
final class TextSearch
{
    /**
     * Split a query into lowercase search terms (whitespace-separated, empties dropped).
     *
     * @return list<string>
     */
    public static function terms(string $query): array
    {
        return array_values(array_filter(
            preg_split('/\s+/', mb_strtolower(trim($query))) ?: [],
            static fn (string $term): bool => $term !== '',
        ));
    }

    /**
     * Whether every term prefixes some word in the text.
     *
     * @param  list<string>  $terms
     */
    public static function matches(string $text, array $terms): bool
    {
        if ($terms === []) {
            return false;
        }

        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_all($terms, fn ($term) => array_any($words, fn ($word) => str_starts_with((string) $word, (string) $term)));
    }
}
