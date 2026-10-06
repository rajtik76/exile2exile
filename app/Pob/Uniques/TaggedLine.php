<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * One PoB item line with its `{key:value}` tags lifted off, e.g.
 * `{variant:1,4}{tags:life}+(60-80) to maximum Life`. Mirrors the tag handling in
 * PathOfBuilding-PoE2's `Classes/Item.lua` ParseRaw: every `{key:value}` group anywhere
 * in the line is removed from the display text, and the variant-selection ones
 * (`variant`, `version`, `group`) decide which of the item's variants the line belongs to
 * (see {@see PobItemVariants::isActive}). Ids are PoB's own 1-based indexes into the
 * item's `Variant:` / `Version:` lists. PoB's `{base:}` tag (paired with `Base Variant:`)
 * is not modelled: no unique in PoB's data uses it, and an untracked tag is still
 * stripped from the text.
 */
final readonly class TaggedLine
{
    /**
     * @param  list<int>|null  $variants  `{variant:...}` ids, null when untagged
     * @param  list<int>|null  $versions  `{version:...}` ids, null when untagged
     * @param  list<int>|null  $groups  `{group:...}` ids (positive only, as PoB reads them), null when untagged
     */
    public function __construct(
        public string $text,
        public ?array $variants = null,
        public ?array $versions = null,
        public ?array $groups = null,
    ) {}

    public static function parse(string $line): self
    {
        $variants = null;
        $versions = null;
        $groups = null;

        $text = preg_replace_callback('/\{([A-Za-z]*):?([^}]*)\}/', static function (array $match) use (&$variants, &$versions, &$groups): string {
            match ($match[1]) {
                'variant' => $variants = self::ids($match[2]),
                'version' => $versions = self::ids($match[2]),
                'group' => $groups = array_values(array_filter(self::ids($match[2]), static fn (int $id): bool => $id > 0)),
                default => null,
            };

            return '';
        }, $line) ?? $line;

        return new self(trim($text), $variants, $versions, $groups);
    }

    /**
     * Every integer in a tag value, as PoB's `parseIdSpec` reads it ("1,4" => [1, 4]).
     *
     * @return list<int>
     */
    private static function ids(string $spec): array
    {
        preg_match_all('/\d+/', $spec, $matches);

        return array_values(array_unique(array_map(intval(...), $matches[0])));
    }
}
