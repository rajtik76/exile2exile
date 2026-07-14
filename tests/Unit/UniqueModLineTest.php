<?php

declare(strict_types=1);

use App\Pob\Uniques\UniqueModLine;

test('it parses a ranged line into a stable key and its rolls', function () {
    $line = UniqueModLine::parse('+(80-120) to maximum Life');

    expect($line->template)->toBe('+(80-120) to maximum Life')
        ->and($line->key)->toBe('+# to maximum Life')
        ->and($line->rolls)->toBe([['min' => 80.0, 'max' => 120.0]]);
});

test('it parses decimal ranges', function () {
    $line = UniqueModLine::parse('(3.1-6) Life Regeneration per second');

    expect($line->rolls)->toBe([['min' => 3.1, 'max' => 6.0]]);
});

test('a line with no ranges has no rolls and is its own key', function () {
    $line = UniqueModLine::parse('Unwavering Stance');

    expect($line->rolls)->toBe([])
        ->and($line->key)->toBe('Unwavering Stance');
});

test('matchConcrete extracts the rolled values from a matching concrete line', function () {
    $line = UniqueModLine::parse('+(80-120) to maximum Life');

    expect($line->matchConcrete('+110 to maximum Life'))->toBe([110.0]);
});

test('matchConcrete supports decimal concrete values', function () {
    $line = UniqueModLine::parse('(8-12) Life Regeneration per second');

    expect($line->matchConcrete('11.9 Life Regeneration per second'))->toBe([11.9]);
});

test('matchConcrete returns null for a line that does not match the template', function () {
    $line = UniqueModLine::parse('+(80-120) to maximum Life');

    expect($line->matchConcrete('+110 to maximum Mana'))->toBeNull();
});

test('matchConcrete on a no-range line only matches its exact text', function () {
    $line = UniqueModLine::parse('Unwavering Stance');

    expect($line->matchConcrete('Unwavering Stance'))->toBe([])
        ->and($line->matchConcrete('Something Else'))->toBeNull();
});

test('matchConcrete rejects a line with the wrong number of values', function () {
    $line = UniqueModLine::parse('+(80-120) to maximum Life');

    expect($line->matchConcrete('+110 to maximum Life and +5 to Spirit'))->toBeNull();
});
