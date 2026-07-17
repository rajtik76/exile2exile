<?php

declare(strict_types=1);

use App\Pob\ModCatalogue;
use App\Support\Planner\Matching\AffixMatcher;
use App\Support\Planner\Matching\AggregateSplitter;
use App\Support\Planner\Matching\MatchContext;

/**
 * The affix matcher and the aggregate splitter are exercised directly against small
 * arbitrary fixtures (same approach as ModCatalogueTest): the LOGIC under test is the
 * reverse-matching - tier picking, family/cap rules, quality clamping, PoB's alternate
 * renderings and aggregate decomposition - not which real GGPK affixes exist.
 */

/** A one-stat affix candidate in the matcher's flattened shape. */
function pureCandidate(string $id, string $type, string $template, int $min, int $max, string $family): array
{
    return [
        'id' => $id,
        'type' => $type,
        'statCount' => 1,
        'template' => $template,
        'statTemplates' => [$template],
        'rolls' => [['stat' => 'stat', 'min' => $min, 'max' => $max]],
        'families' => [$family],
        'crafted' => false,
        'ladder' => false,
    ];
}

/** A two-stat hybrid candidate in the matcher's flattened shape. */
function hybridCandidate(string $id, string $type, array $templates, array $rolls, string $family): array
{
    return [
        'id' => $id,
        'type' => $type,
        'statCount' => 2,
        'template' => implode("\n", $templates),
        'statTemplates' => $templates,
        'rolls' => $rolls,
        'families' => [$family],
        'crafted' => true,
        'ladder' => false,
    ];
}

describe('AggregateSplitter', function () {
    it('splits a summed line into two same-wording pures of different families', function () {
        $candidates = [
            pureCandidate('EsTiny', 'prefix', '#% increased Energy Shield', 5, 10, 'EsTiny'),
            pureCandidate('EsNatural', 'prefix', '#% increased Energy Shield', 60, 80, 'EsNatural'),
            pureCandidate('EsCraft', 'prefix', '#% increased Energy Shield', 60, 80, 'EsCraft'),
        ];
        $context = new MatchContext;

        $line = '147% increased Energy Shield';
        $unmatched = new AggregateSplitter()->decompose([$line], [$line], $candidates, 3, $context);

        expect($unmatched)->toBe([])
            ->and($context->stats)->toBe([
                ['modId' => 'EsNatural', 'values' => [80]],
                ['modId' => 'EsCraft', 'values' => [67]],
            ])
            ->and($context->counts['prefix'])->toBe(2);
    });

    it('refuses a pure-pair split that would burst the per-type cap', function () {
        $candidates = [
            pureCandidate('EsNatural', 'prefix', '#% increased Energy Shield', 60, 80, 'EsNatural'),
            pureCandidate('EsCraft', 'prefix', '#% increased Energy Shield', 60, 80, 'EsCraft'),
        ];
        $context = new MatchContext;
        $context->counts['prefix'] = 2;

        $line = '147% increased Energy Shield';
        $unmatched = new AggregateSplitter()->decompose([$line], [$line], $candidates, 3, $context);

        expect($unmatched)->toBe([$line])
            ->and($context->stats)->toBe([]);
    });

    it('refuses a pure-pair split whose family is already claimed on the item', function () {
        $candidates = [
            pureCandidate('EsNatural', 'prefix', '#% increased Energy Shield', 60, 80, 'EsNatural'),
            pureCandidate('EsCraft', 'prefix', '#% increased Energy Shield', 60, 80, 'EsCraft'),
        ];
        $context = new MatchContext;
        $context->families = ['EsCraft'];

        $line = '147% increased Energy Shield';
        $unmatched = new AggregateSplitter()->decompose([$line], [$line], $candidates, 3, $context);

        expect($unmatched)->toBe([$line]);
    });

    it('splits a summed line into a pure affix plus a hybrid and re-splits the companion line', function () {
        $candidates = [
            pureCandidate('ArmourPure', 'prefix', '#% increased Armour', 40, 64, 'ArmourPure'),
            pureCandidate('LifePure', 'prefix', '+# to maximum Life', 20, 40, 'LifePure'),
            hybridCandidate(
                'ArmourLifeHybrid',
                'prefix',
                ['#% increased Armour', '+# to maximum Life'],
                [['stat' => 'armour', 'min' => 30, 'max' => 44], ['stat' => 'life', 'min' => 10, 'max' => 20]],
                'ArmourLifeHybrid',
            ),
        ];
        $lines = ['94% increased Armour', '+36 to maximum Life'];

        // The companion line first matched alone as LifePure; an unrelated mod the
        // candidate list doesn't know sits alongside it (its family lookup falls back).
        $context = new MatchContext;
        $context->stats = [
            ['modId' => 'LifePure', 'values' => [36]],
            ['modId' => 'UnknownMod', 'values' => [1]],
        ];
        $context->counts = ['prefix' => 1, 'suffix' => 1];
        $context->families = ['LifePure'];

        $unmatched = new AggregateSplitter()->decompose(['94% increased Armour'], $lines, $candidates, 3, $context);

        expect($unmatched)->toBe([])
            ->and($context->stats)->toBe([
                ['modId' => 'UnknownMod', 'values' => [1]],
                ['modId' => 'ArmourLifeHybrid', 'values' => [30, 10]],
                ['modId' => 'ArmourPure', 'values' => [64]],
                ['modId' => 'LifePure', 'values' => [26]],
            ])
            ->and($context->counts)->toBe(['prefix' => 3, 'suffix' => 1]);
    });

    it('refuses a hybrid split whose family is already claimed, even at the companion-only bound', function () {
        // The companion roll reaches past the companion line's own total, so the split
        // walk crosses the exact-total point (hybrid part alone) and the negative
        // remainder beyond it - and still fails on the family clash every time.
        $candidates = [
            pureCandidate('ArmourPure', 'prefix', '#% increased Armour', 40, 64, 'ArmourPure'),
            pureCandidate('LifePure', 'prefix', '+# to maximum Life', 20, 40, 'LifePure'),
            hybridCandidate(
                'ArmourLifeHybrid',
                'prefix',
                ['#% increased Armour', '+# to maximum Life'],
                [['stat' => 'armour', 'min' => 30, 'max' => 44], ['stat' => 'life', 'min' => 30, 'max' => 40]],
                'ArmourPure',
            ),
        ];
        $lines = ['94% increased Armour', '+36 to maximum Life'];
        $context = new MatchContext;
        $context->stats = [['modId' => 'LifePure', 'values' => [36]]];
        $context->counts = ['prefix' => 1, 'suffix' => 0];
        $context->families = ['LifePure'];

        $unmatched = new AggregateSplitter()->decompose(['94% increased Armour'], $lines, $candidates, 3, $context);

        expect($unmatched)->toBe(['94% increased Armour'])
            ->and($context->stats)->toBe([['modId' => 'LifePure', 'values' => [36]]]);
    });

    it('leaves a line without numbers or within the pure ceiling unsplit', function () {
        $candidates = [
            pureCandidate('EsNatural', 'prefix', '#% increased Energy Shield', 60, 80, 'EsNatural'),
        ];
        $context = new MatchContext;

        $lines = ['Cannot be Frozen', '70% increased Energy Shield'];
        $unmatched = new AggregateSplitter()->decompose($lines, $lines, $candidates, 3, $context);

        expect($unmatched)->toBe($lines)
            ->and($context->stats)->toBe([]);
    });
});

describe('AffixMatcher', function () {
    beforeEach(function () {
        $default = [['tag' => 'default', 'weight' => 1000]];

        fakeGameData([
            'resources/poe2/ggpk/mods.json' => [
                // Two tiers of one suffix sharing a family: a legal item carries only one.
                ['id' => 'FireResist1', 'name' => 'of the Kiln', 'domain' => 'Item', 'group' => 'FireResistance', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['+#% to Fire Resistance'], 'rolls' => [['stat' => 'fire_resist', 'min' => 5, 'max' => 10]], 'families' => ['FireResist'], 'spawnWeights' => $default],
                ['id' => 'FireResist2', 'name' => 'of the Furnace', 'domain' => 'Item', 'group' => 'FireResistance', 'type' => 'suffix', 'tier' => 2, 'level' => 10, 'stats' => ['+#% to Fire Resistance'], 'rolls' => [['stat' => 'fire_resist', 'min' => 11, 'max' => 20]], 'families' => ['FireResist'], 'spawnWeights' => $default],

                // A negative roll rendered positive under inverted ("reduced") wording.
                ['id' => 'ReducedCharges1', 'name' => 'Sparing', 'domain' => 'Item', 'group' => 'ChargesUsed', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['#% reduced Charges used'], 'rolls' => [['stat' => 'charges_used', 'min' => -60, 'max' => -40]], 'families' => ['ChargesUsed'], 'spawnWeights' => $default],

                // A per-minute roll PoB renders per second.
                ['id' => 'ChargeGain1', 'name' => 'Replenishing', 'domain' => 'Item', 'group' => 'ChargeGain', 'type' => 'prefix', 'tier' => 1, 'level' => 1, 'stats' => ['# Charges gained per Second'], 'rolls' => [['stat' => 'charge_recovery_every_minute', 'min' => 120, 'max' => 180]], 'families' => ['ChargeGain'], 'spawnWeights' => $default],

                // A constant hidden roll that renders no number at all.
                ['id' => 'InstantRecovery1', 'name' => 'of Bursting', 'domain' => 'Item', 'group' => 'InstantRecovery', 'type' => 'suffix', 'tier' => 1, 'level' => 1, 'stats' => ['Instant Recovery'], 'rolls' => [['stat' => 'instant_recovery', 'min' => 100, 'max' => 100]], 'families' => ['InstantRecovery'], 'spawnWeights' => $default],
            ],
        ]);

        $this->matcher = new AffixMatcher(new ModCatalogue);
    });

    it('drops every line when the base offers no domain, tags or mod budget', function () {
        $lines = ['+8% to Fire Resistance'];

        expect($this->matcher->match($lines, null, ['default'], null, 3, false))
            ->toBe(['stats' => [], 'dropped' => $lines])
            ->and($this->matcher->match($lines, 'Item', [], null, 3, false))
            ->toBe(['stats' => [], 'dropped' => $lines])
            ->and($this->matcher->match($lines, 'Item', ['default'], null, 0, false))
            ->toBe(['stats' => [], 'dropped' => $lines]);
    });

    it('drops a second line of an already-claimed mutual-exclusion family', function () {
        $result = $this->matcher->match(
            ['+8% to Fire Resistance', '+15% to Fire Resistance'],
            'Item', ['default'], null, 3, false,
        );

        expect($result['stats'])->toBe([['modId' => 'FireResist1', 'values' => [8]]])
            ->and($result['dropped'])->toBe(['+15% to Fire Resistance']);
    });

    it('clamps a quality-inflated value to its tier ceiling on a catalyst slot only', function () {
        $line = '+25% to Fire Resistance';

        // Over every tier's ceiling but within 2x of the top tier: real roll inflated
        // by catalyst quality, stored clamped - but only where catalysts apply at all.
        expect($this->matcher->match([$line], 'Item', ['default'], null, 3, true))
            ->toBe(['stats' => [['modId' => 'FireResist2', 'values' => [20]]], 'dropped' => []])
            ->and($this->matcher->match([$line], 'Item', ['default'], null, 3, false))
            ->toBe(['stats' => [], 'dropped' => [$line]]);
    });

    it('drops a value too large even for quality inflation', function () {
        $line = '+45% to Fire Resistance';

        expect($this->matcher->match([$line], 'Item', ['default'], null, 3, true))
            ->toBe(['stats' => [], 'dropped' => [$line]]);
    });

    it("accepts PoB's alternate renderings: inverted, per-second and hidden-roll lines", function () {
        $result = $this->matcher->match(
            ['45% reduced Charges used', '2.5 Charges gained per Second', 'Instant Recovery'],
            'Item', ['default'], null, 3, false,
        );

        expect($result['dropped'])->toBe([])
            ->and($result['stats'])->toBe([
                ['modId' => 'ReducedCharges1', 'values' => [-45]],
                ['modId' => 'ChargeGain1', 'values' => [150]],
                ['modId' => 'InstantRecovery1', 'values' => [100]],
            ]);
    });
});
