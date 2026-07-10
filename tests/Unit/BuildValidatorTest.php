<?php

declare(strict_types=1);

use App\Pob\Data\Ascendancy;
use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\CharacterClass;
use App\Pob\Data\Gem;
use App\Pob\Data\GemGroup;
use App\Pob\Decoding\BuildDecoder;
use App\Pob\Reference\BuildReference;
use App\Pob\Validation\BuildValidator;

/**
 * @param  list<int>  $nodes
 * @param  list<Gem>  $gems
 */
function snapshotWith(array $nodes, array $gems = []): BuildSnapshot
{
    return new BuildSnapshot(
        level: 1,
        class: CharacterClass::Mercenary,
        ascendancy: null,
        classId: 0,
        treeVersion: '0_4',
        passiveNodes: $nodes,
        skillGroups: $gems === [] ? [] : [new GemGroup('Main', $gems)],
        items: [],
    );
}

function gem(?string $gemId, string $name = 'Gem'): Gem
{
    return new Gem(name: $name, skillId: null, gemId: $gemId, level: 1, quality: 0, isSupport: false);
}

/**
 * @param  array<int, true>  $nodes
 * @param  array<string, true>  $gems
 */
function reference(array $nodes, array $gems): BuildReference
{
    return new readonly class($nodes, $gems) implements BuildReference
    {
        public function __construct(private array $nodes, private array $gems) {}

        public function passiveNodeIds(): array
        {
            return $this->nodes;
        }

        public function gemIds(): array
        {
            return $this->gems;
        }
    };
}

function decoderReturning(BuildSnapshot $snapshot): BuildDecoder
{
    return new readonly class($snapshot) implements BuildDecoder
    {
        public function __construct(private BuildSnapshot $snapshot) {}

        public function import(string $code): BuildSnapshot
        {
            return $this->snapshot;
        }
    };
}

function decoderThrowing(): BuildDecoder
{
    return new class implements BuildDecoder
    {
        public function import(string $code): BuildSnapshot
        {
            throw new RuntimeException('boom');
        }
    };
}

it('accepts a build whose nodes and gems all exist in the current data', function () {
    $validator = new BuildValidator(
        decoderReturning(snapshotWith([1, 2], [gem('SkillGemX')])),
        reference([1 => true, 2 => true], ['SkillGemX' => true]),
    );

    $result = $validator->validate('code');

    expect($result->valid)->toBeTrue()
        ->and($result->errors)->toBe([])
        ->and($result->snapshot)->not->toBeNull();
});

it('rejects a build allocating a node that is not in the current tree', function () {
    $validator = new BuildValidator(
        decoderReturning(snapshotWith([1, 99])),
        reference([1 => true], []),
    );

    $result = $validator->validate('code');

    expect($result->valid)->toBeFalse()
        ->and($result->errors[0])->toContain('passive node');
});

it('rejects a build using a gem that is not in the current league', function () {
    $validator = new BuildValidator(
        decoderReturning(snapshotWith([1], [gem('SkillGemRemoved', 'Old Skill')])),
        reference([1 => true], ['SkillGemKnown' => true]),
    );

    $result = $validator->validate('code');

    expect($result->valid)->toBeFalse()
        ->and($result->errors[0])->toContain('Old Skill');
});

it('ignores gems without a gem id', function () {
    $validator = new BuildValidator(
        decoderReturning(snapshotWith([1], [gem(null, 'Eternal Mark')])),
        reference([1 => true], []),
    );

    expect($validator->validate('code')->valid)->toBeTrue();
});

it('treats a decode failure as invalid data, not an error', function () {
    $validator = new BuildValidator(decoderThrowing(), reference([], []));

    $result = $validator->validate('garbage');

    expect($result->valid)->toBeFalse()
        ->and($result->errors[0])->toContain('corrupt');
});

it('maps every ascendancy back to its base class', function () {
    expect(Ascendancy::Lich->characterClass())->toBe(CharacterClass::Witch)
        ->and(Ascendancy::Titan->characterClass())->toBe(CharacterClass::Warrior);
});

it('rejects unknown class and ascendancy names', function () {
    expect(fn () => CharacterClass::fromName('Templar'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => Ascendancy::tryFromName('Necromancer'))->toThrow(InvalidArgumentException::class)
        ->and(Ascendancy::tryFromName('None'))->toBeNull();
});
