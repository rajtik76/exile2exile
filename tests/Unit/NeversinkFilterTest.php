<?php

declare(strict_types=1);

use App\Filter\Neversink\NeversinkFilterRepository;
use App\Filter\Neversink\NeversinkStrictness;
use App\Filter\Neversink\NeversinkStyle;
use App\Filter\Neversink\NeversinkStyleExtractor;
use App\Filter\Neversink\NeversinkStyleTheme;

test('every style and strictness pair has a vendored NeverSink file', function () {
    $repo = NeversinkFilterRepository::default();

    foreach (NeversinkStyle::cases() as $style) {
        foreach (NeversinkStrictness::cases() as $strictness) {
            expect($repo->has($style, $strictness))->toBeTrue(
                "missing vendored file for {$style->value} / {$strictness->value}",
            );
        }
    }
});

test('the vendored body is an unmodified NeverSink filter', function () {
    $body = NeversinkFilterRepository::default()->body(NeversinkStyle::Cobalt, NeversinkStrictness::Strict);

    expect($body)
        ->toContain("NeverSink's Indepth Loot Filter")
        ->toContain('TYPE:     3-STRICT')
        ->toContain('STYLE:    COBALT');
});

test('the style extractor pulls a block styling verbatim', function () {
    $body = NeversinkFilterRepository::default()->body(NeversinkStyle::Default, NeversinkStrictness::SemiStrict);
    $actions = new NeversinkStyleExtractor($body)->style('$type->currency $tier->s');

    $rendered = array_map(static fn ($action): string => $action->render(), $actions);

    // The top currency tier is NeverSink's red chase plate with a sound, beam and minimap star.
    expect($rendered)
        ->toContain('SetTextColor 255 0 0 255')
        ->toContain('PlayAlertSound 6 300')
        ->toContain('MinimapIcon 0 Red Star');
});

test('the style theme maps a visual tier onto a NeverSink marker', function () {
    $body = NeversinkFilterRepository::default()->body(NeversinkStyle::Default, NeversinkStrictness::SemiStrict);
    $extractor = new NeversinkStyleExtractor($body);
    $theme = new NeversinkStyleTheme($extractor, [['$type->currency $tier->s']]);

    $rendered = array_map(static fn ($action): string => $action->render(), $theme->styleFor(1));

    expect($rendered)->toContain('SetTextColor 255 0 0 255');
});

test('the extractor falls back down the marker ladder', function () {
    $body = NeversinkFilterRepository::default()->body(NeversinkStyle::Default, NeversinkStrictness::SemiStrict);
    $extractor = new NeversinkStyleExtractor($body);

    // A bogus first marker, a real second one: firstStyle should skip to the real block.
    expect($extractor->firstStyle(['$type->nope $tier->nope', '$type->currency $tier->s']))
        ->not->toBeEmpty();
});
