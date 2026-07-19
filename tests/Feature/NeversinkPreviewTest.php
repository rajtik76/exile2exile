<?php

declare(strict_types=1);

use App\Filter\Neversink\NeversinkFilterRepository;
use App\Filter\Neversink\NeversinkPreviewBuilder;
use App\Filter\Neversink\NeversinkStrictness;
use App\Filter\Neversink\NeversinkStyle;

/**
 * @param  list<array{name: string, hidden: bool, fontSize: int, text: array{int, int, int}, border: array{int, int, int}|null, background: array{int, int, int}|null, beam: string|null}>  $labels
 */
function labelNamed(array $labels, string $name): array
{
    foreach ($labels as $label) {
        if ($label['name'] === $name) {
            return $label;
        }
    }

    throw new RuntimeException("no preview label for {$name}");
}

function previewLabels(NeversinkStrictness $strictness): array
{
    $body = NeversinkFilterRepository::default()->body(NeversinkStyle::Default, $strictness);

    return new NeversinkPreviewBuilder()->labels($body);
}

test('the top currency is always shown loud, never hidden', function () {
    foreach ([NeversinkStrictness::Regular, NeversinkStrictness::UberPlusStrict] as $strictness) {
        $divine = labelNamed(previewLabels($strictness), 'Divine Orb');

        expect($divine['hidden'])->toBeFalse()
            ->and($divine['background'])->not->toBeNull()
            ->and($divine['fontSize'])->toBeGreaterThanOrEqual(40);
    }
});

test('cheap currency is shown at Regular but hidden once strict', function () {
    expect(labelNamed(previewLabels(NeversinkStrictness::Regular), 'Scroll of Wisdom')['hidden'])->toBeFalse();
    expect(labelNamed(previewLabels(NeversinkStrictness::UberPlusStrict), 'Scroll of Wisdom')['hidden'])->toBeTrue();
});

test('a low-level uncut gem is not styled as loud as the top currency', function () {
    $gem = labelNamed(previewLabels(NeversinkStrictness::Regular), 'Uncut Skill Gem');
    $divine = labelNamed(previewLabels(NeversinkStrictness::Regular), 'Divine Orb');

    // The gem is quieter: smaller and without the chase plate the top currency fills.
    expect($gem['fontSize'])->toBeLessThan($divine['fontSize']);
});

test('the preview endpoint returns labels as json', function () {
    $this->get(route('filter.preview', ['theme' => 'cobalt', 'strictness' => '3-strict']))
        ->assertOk()
        ->assertJsonStructure(['labels' => [['name', 'hidden', 'fontSize', 'text']]]);
});

test('the preview reflects Custom category picks like the downloaded body', function () {
    $labels = $this->get(route('filter.preview', ['strictness' => '1-regular', 'off' => 'uncut-skill-gems']))
        ->assertOk()
        ->json('labels');

    // The hidden pick greys out in the preview exactly like in the downloaded NeverSink
    // body, while an untoggled category keeps its Show styling. (The download additionally
    // prepends economy/build override highlights, which the preview does not simulate.)
    expect(labelNamed($labels, 'Uncut Skill Gem')['hidden'])->toBeTrue()
        ->and(labelNamed($labels, 'Divine Orb')['hidden'])->toBeFalse();
});
