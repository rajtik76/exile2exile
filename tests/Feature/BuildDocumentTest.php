<?php

use App\Build\BuildDocumentBuilder;
use App\Models\SharedBuild;
use Illuminate\Support\Facades\Cache;

/**
 * A build whose node ids are real entries in the current tree, chosen to exercise
 * every branch of the resolver:
 *  - 59636 "Open Mind"    - a notable with no Witch override
 *  - 51184 "Raw Power"    - a notable the Witch overrides to "Raw Destruction"
 *  - 52    "Zealot's Oath"- a keystone
 *  - 22419 / 18407        - generic attribute nodes
 */
function aiBuild(array $overrides = []): array
{
    return array_merge([
        'className' => 'Witch',
        'ascendId' => 'Witch1',
        'allocated' => [59636, 51184, 52, 22419, 18407],
        'attributeChoices' => [22419 => 'int', 18407 => 'str'],
        'jewels' => [],
        'treeVersion' => '0_5',
    ], $overrides);
}

test('the builder applies the class override to a notable name', function () {
    $document = app(BuildDocumentBuilder::class)->build(aiBuild());

    // 51184 is "Raw Power" on the base tree but the Witch shows "Raw Destruction"
    // in its place - the summary must reflect what the class actually sees.
    expect(collect($document->notables)->pluck('name'))
        ->toContain('Raw Destruction')
        ->not->toContain('Raw Power')
        ->toContain('Open Mind');
});

test('the builder resolves class, ascendancy, keystones and attribute split', function () {
    $document = app(BuildDocumentBuilder::class)->build(aiBuild());

    expect($document->class)->toBe('Witch')
        ->and($document->ascendancy)->toBe('Infernalist')
        ->and($document->pointsAllocated)->toBe(5)
        ->and($document->attributes)->toBe(['str' => 1, 'dex' => 0, 'int' => 1, 'unspecified' => 0])
        ->and(collect($document->keystones)->pluck('name'))->toContain("Zealot's Oath");
});

test('the ascendancy resolves whether stored as a name or a tree id', function () {
    // Real imported shares store the PoB enum value - the display name itself -
    // while a tree-native share may store the tree id. Both must resolve.
    $byName = app(BuildDocumentBuilder::class)->build(aiBuild(['ascendId' => 'Blood Mage']));
    $byId = app(BuildDocumentBuilder::class)->build(aiBuild(['ascendId' => 'Witch2']));

    expect($byName->ascendancy)->toBe('Blood Mage')
        ->and($byId->ascendancy)->toBe('Blood Mage');
});

test('an attribute node without a recorded choice counts as unspecified', function () {
    $document = app(BuildDocumentBuilder::class)->build(aiBuild([
        'attributeChoices' => [22419 => 'int'],
    ]));

    // 18407 is allocated but has no choice, so it lands in `unspecified`.
    expect($document->attributes)->toBe(['str' => 0, 'dex' => 0, 'int' => 1, 'unspecified' => 1]);
});

test('a node id absent from the current tree is skipped, not guessed', function () {
    $document = app(BuildDocumentBuilder::class)->build(aiBuild([
        'allocated' => [59636, 999999999],
    ]));

    expect($document->pointsAllocated)->toBe(2)
        ->and($document->notables)->toHaveCount(1)
        ->and($document->notables[0]['name'])->toBe('Open Mind');
});

test('the JSON endpoint serves a flat, versioned build document', function () {
    $shared = SharedBuild::create(['slug' => 'aiDoc123XYZ0', 'build' => aiBuild()]);

    $this->getJson(route('shared.json', $shared->slug))
        ->assertOk()
        ->assertJsonPath('schemaVersion', 1)
        ->assertJsonPath('game', 'poe2')
        ->assertJsonPath('treeVersion', '0_5')
        ->assertJsonPath('class', 'Witch')
        ->assertJsonPath('ascendancy', 'Infernalist')
        ->assertJsonPath('passives.pointsAllocated', 5)
        ->assertJsonPath('passives.attributes.int', 1)
        ->assertJsonMissingPath('data')
        ->assertJsonFragment(['name' => 'Raw Destruction'])
        ->assertJsonFragment(['name' => "Zealot's Oath"]);
});

test('the JSON endpoint 404s for an unknown slug', function () {
    $this->getJson('/t/missing12345.json')->assertNotFound();
});

test('the JSON endpoint is served from cache without re-reading the row', function () {
    $shared = SharedBuild::create(['slug' => 'aiCache123XY', 'build' => aiBuild()]);

    $first = $this->getJson(route('shared.json', $shared->slug))->assertOk();

    // Drop the row: a second hit that still answers can only be served from the
    // cached document, proving the DB is not read again once warm.
    $shared->delete();

    $this->getJson(route('shared.json', $shared->slug))
        ->assertOk()
        ->assertExactJson($first->json());
});

test('the cached document survives a serializing cache store', function () {
    // The default test cache is the array store, which never serializes - so it
    // hides round-trip bugs. Force a store that serializes (as Redis does in
    // production) to prove the cached value reads back intact on a second hit.
    config(['cache.default' => 'file']);
    Cache::store('file')->flush();

    $shared = SharedBuild::create(['slug' => 'aiSerialize12', 'build' => aiBuild()]);

    $first = $this->getJson(route('shared.json', $shared->slug))->assertOk();

    // The second hit reads the value back through unserialize; a document cached
    // as a value object would surface here as an "incomplete object" 500.
    $this->getJson(route('shared.json', $shared->slug))
        ->assertOk()
        ->assertExactJson($first->json());

    Cache::store('file')->flush();
});

test('the shared page server-renders a machine-readable summary a raw fetch can read', function () {
    $shared = SharedBuild::create(['slug' => 'aiHead123XYZ', 'build' => aiBuild()]);

    $html = $this->get(route('shared.show', $shared->slug))->assertOk()->getContent();

    // Head pointer for standards-aware clients...
    expect($html)
        ->toContain('rel="alternate"')
        ->toContain('/t/aiHead123XYZ.json')
        // ...and the visible (sr-only) body summary that survives a markdown fetch:
        // resolved class, ascendancy, notables and keystone, all as plain text.
        ->toContain('Path of Exile 2 passive tree build')
        ->toContain('Infernalist')
        ->toContain('Raw Destruction')
        ->toContain("Zealot's Oath");
});
