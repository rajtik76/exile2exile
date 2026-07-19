<?php

declare(strict_types=1);

use App\Filter\Custom\CustomFilterTransformer;
use App\Filter\Custom\FilterCategory;

/** A miniature NeverSink-shaped body covering the cases the transformer must handle. */
function syntheticNeversinkBody(): string
{
    return implode("\n", [
        'Show # %H3 $type->gold $tier->any !gold_pilesmall',
        "\tStackSize >= 50",
        "\tSetFontSize 40",
        "\tPlayAlertSound 1 300",
        "\tPlayEffect Yellow Temp",
        "\tMinimapIcon 2 Yellow Circle",
        '',
        'Show # %D7 $type->gold $tier->stack3 !gold_pilehuge',
        "\tSetFontSize 45",
        '',
        'Show # %D6 $type->gold $tier->stackxl1lvl !gold_pilelarge',
        "\tSetFontSize 44",
        '',
        'Hide # $type->currency $tier->exhide !utility_minimize',
        "\tBaseType == \"Transmutation Shard\"",
        '',
        'Show # $type->uniques $tier->t1 !apex_stier',
        "\tSetTextColor 255 0 0 255",
        "\tPlayAlertSound 6 300",
        '',
        'Show # $type->gems->uncut $tier->skill20 !apex_stier',
        "\tBaseType \"Uncut Skill Gem\"",
        "\tSetFontSize 45",
        '',
        // The vendored files mostly use the `==` operator and multi-value lists.
        'Show # %H5 $type->uniques $tier->t3 !uniques_b',
        "\tRarity Unique",
        "\tBaseType == \"Silk Robe\" \"Uncut Skill Gem\" \"Sapphire Ring\"",
        "\tSetFontSize 42",
    ]);
}

test('with no disabled categories the body passes through verbatim', function () {
    $body = syntheticNeversinkBody();

    $result = (new CustomFilterTransformer)->apply($body, []);

    expect($result->body)->toBe($body)
        ->and($result->applied)->toBe([])
        ->and($result->hiddenBaseTypes)->toBe([])
        ->and($result->hiddenBaseTypeSubstrings)->toBe([]);
});

test('blocks in a disabled category flip to Hide and lose their alert actions', function () {
    $custom = (new CustomFilterTransformer)->apply(syntheticNeversinkBody(), [FilterCategory::GoldPiles]);

    expect($custom->applied)->toBe([FilterCategory::GoldPiles]);
    expect($custom->body)
        ->toContain('Hide # %H3 $type->gold $tier->any !gold_pilesmall')
        ->not->toContain('Show # %H3 $type->gold $tier->any')
        // Conditions and display styling stay; only alert actions go.
        ->toContain('StackSize >= 50')
        ->toContain('SetFontSize 40')
        ->not->toContain('PlayEffect Yellow Temp')
        ->not->toContain('MinimapIcon 2 Yellow Circle')
        ->not->toContain('PlayAlertSound 1 300');
});

test('blocks outside the disabled category are untouched', function () {
    expect((new CustomFilterTransformer)->apply(syntheticNeversinkBody(), [FilterCategory::GoldPiles])->body)
        // Large and huge gold piles are excluded from the small-and-medium-piles category.
        ->toContain('Show # %D7 $type->gold $tier->stack3 !gold_pilehuge')
        ->toContain('Show # %D6 $type->gold $tier->stackxl1lvl !gold_pilelarge')
        // Top-tier uniques are never toggleable and keep their alert sound.
        ->toContain('Show # $type->uniques $tier->t1 !apex_stier')
        ->toContain('PlayAlertSound 6 300')
        // Pre-existing Hide blocks stay as they are.
        ->toContain('Hide # $type->currency $tier->exhide !utility_minimize');
});

test('muted blocks contribute their base types so the economy overlay can skip them', function () {
    $custom = (new CustomFilterTransformer)->apply(syntheticNeversinkBody(), [FilterCategory::UncutSkillGems, FilterCategory::GoldPiles]);

    // The gem block names its base on a bare `BaseType "..."` line, which the game treats
    // as a substring match; the muted gold blocks match by stack size only.
    expect($custom->hiddenBaseTypeSubstrings)->toBe(['Uncut Skill Gem'])
        ->and($custom->hiddenBaseTypes)->toBe([])
        // The substring semantic is what hides poe2scout's per-level gem names.
        ->and($custom->hidesBaseType('Uncut Skill Gem (Level 18)'))->toBeTrue()
        ->and($custom->hidesBaseType('Divine Orb'))->toBeFalse();
});

test('multi-value BaseType == lines contribute every name, deduplicated per shape', function () {
    $custom = (new CustomFilterTransformer)->apply(
        syntheticNeversinkBody(),
        [FilterCategory::UncutSkillGems, FilterCategory::LowUniques],
    );

    // The `BaseType == "..." "..."` uniques line lands in the exact list - all names, not
    // just the first ("Sapphire Ring" is named nowhere else) - while the bare gem line
    // lands in the substring list, mirroring the game's own matching semantics.
    expect($custom->hiddenBaseTypes)->toBe(['Silk Robe', 'Uncut Skill Gem', 'Sapphire Ring'])
        ->and($custom->hiddenBaseTypeSubstrings)->toBe(['Uncut Skill Gem']);
});

test('picks that flip no block are not reported as applied', function () {
    $body = syntheticNeversinkBody();

    // The synthetic body has no rare-gear blocks, so the pick is a no-op.
    $custom = (new CustomFilterTransformer)->apply($body, [FilterCategory::RareGear]);

    expect($custom->body)->toBe($body)
        ->and($custom->applied)->toBe([]);
});

test('availableIn drops categories a strict level has nothing left to toggle for', function () {
    $base = dirname(__DIR__, 2).'/resources/neversink/filters/default';

    $regular = FilterCategory::availableIn((string) file_get_contents("{$base}/1-regular.filter"));
    $uberPlus = FilterCategory::availableIn((string) file_get_contents("{$base}/6-uber-plus-strict.filter"));

    expect($regular)->toContain(FilterCategory::RareGear)
        // 6-uber-plus has no rare-gear Show blocks left, but uncut gems stay toggleable.
        ->and($uberPlus)->not->toContain(FilterCategory::RareGear)
        ->and($uberPlus)->toContain(FilterCategory::UncutSkillGems);
});

// Only the permissive levels list every block; stricter files drop whole sections (e.g.
// 6-uber-plus has no rare-gear blocks left), so they are not asserted here.
test('every category matches at least one block marker in the permissive vendored levels', function (string $file) {
    $body = (string) file_get_contents(dirname(__DIR__, 2)."/resources/neversink/filters/default/{$file}.filter");

    preg_match_all('/^(?:Show|Hide)\b.*\$type->(\S+)(?:\s+\$tier->(\S+))?/m', $body, $markers, PREG_SET_ORDER);

    $unmatched = array_filter(
        FilterCategory::cases(),
        fn (FilterCategory $category): bool => ! array_any(
            $markers,
            fn (array $marker): bool => $category->matches($marker[1], $marker[2] ?? ''),
        ),
    );

    expect(array_map(fn (FilterCategory $c): string => $c->value, array_values($unmatched)))->toBe([]);
})->with(['0-soft', '1-regular']);
