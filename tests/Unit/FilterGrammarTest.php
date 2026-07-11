<?php

declare(strict_types=1);

use App\Filter\Actions;
use App\Filter\Color;
use App\Filter\Conditions;
use App\Filter\FilterBlock;
use App\Filter\FilterColor;
use App\Filter\FilterDocument;
use App\Filter\MinimapShape;
use App\Filter\Operator;
use App\Filter\Rarity;

test('conditions render to their exact filter lines', function () {
    expect(Conditions::itemClass('Boots', 'Gloves')->render())->toBe('Class == "Boots" "Gloves"')
        ->and(Conditions::baseType('Sapphire Ring')->render())->toBe('BaseType == "Sapphire Ring"')
        ->and(Conditions::rarity(Rarity::Normal, Rarity::Magic, Rarity::Rare)->render())->toBe('Rarity Normal Magic Rare')
        ->and(Conditions::itemLevel(Operator::AtLeast, 82)->render())->toBe('ItemLevel >= 82')
        ->and(Conditions::unidentifiedItemTier(Operator::AtLeast, 4)->render())->toBe('UnidentifiedItemTier >= 4')
        ->and(Conditions::stackSize(Operator::MoreThan, 1)->render())->toBe('StackSize > 1')
        ->and(Conditions::baseEnergyShield(Operator::MoreThan, 0)->render())->toBe('BaseEnergyShield > 0')
        ->and(Conditions::identified(true)->render())->toBe('Identified True')
        ->and(Conditions::corrupted(false)->render())->toBe('Corrupted False');
});

test('every numeric condition renders its exact filter keyword', function () {
    expect(Conditions::areaLevel(Operator::AtLeast, 65)->render())->toBe('AreaLevel >= 65')
        ->and(Conditions::dropLevel(Operator::AtMost, 44)->render())->toBe('DropLevel <= 44')
        ->and(Conditions::quality(Operator::MoreThan, 10)->render())->toBe('Quality > 10')
        ->and(Conditions::sockets(Operator::AtLeast, 3)->render())->toBe('Sockets >= 3')
        ->and(Conditions::baseArmour(Operator::MoreThan, 0)->render())->toBe('BaseArmour > 0')
        ->and(Conditions::baseEvasion(Operator::MoreThan, 0)->render())->toBe('BaseEvasion > 0')
        ->and(Conditions::gemLevel(Operator::AtLeast, 18)->render())->toBe('GemLevel >= 18')
        ->and(Conditions::waystoneTier(Operator::AtLeast, 15)->render())->toBe('WaystoneTier >= 15')
        ->and(Conditions::width(Operator::AtMost, 2)->render())->toBe('Width <= 2')
        ->and(Conditions::height(Operator::LessThan, 4)->render())->toBe('Height < 4');
});

test('every flag condition renders its exact filter keyword', function () {
    expect(Conditions::mirrored(true)->render())->toBe('Mirrored True')
        ->and(Conditions::anyEnchantment(false)->render())->toBe('AnyEnchantment False');
});

test('HasExplicitMod renders the count against the operator and quotes each affix', function () {
    expect(Conditions::hasExplicitMod(Operator::AtLeast, 1, "Athlete's", 'of the Yeti')->render())
        ->toBe('HasExplicitMod >=1 "Athlete\'s" "of the Yeti"');
});

test('a text-list, rarity or mod condition with no values is rejected', function () {
    Conditions::itemClass();
})->throws(InvalidArgumentException::class);

test('colours validate their channel range', function () {
    expect(new Color(255, 0, 0)->render())->toBe('255 0 0 255')
        ->and(new Color(0, 240, 190, 128)->render())->toBe('0 240 190 128');

    expect(fn () => new Color(256, 0, 0))->toThrow(InvalidArgumentException::class);
});

test('actions render to their exact filter lines', function () {
    expect(Actions::textColor(new Color(200, 200, 200))->render())->toBe('SetTextColor 200 200 200 255')
        ->and(Actions::borderColor(new Color(240, 100, 0))->render())->toBe('SetBorderColor 240 100 0 255')
        ->and(Actions::fontSize(45)->render())->toBe('SetFontSize 45')
        ->and(Actions::minimapIcon(0, FilterColor::Blue, MinimapShape::Diamond)->render())->toBe('MinimapIcon 0 Blue Diamond')
        ->and(Actions::beam(FilterColor::Blue, true)->render())->toBe('PlayEffect Blue Temp')
        ->and(Actions::beam(FilterColor::Green)->render())->toBe('PlayEffect Green')
        ->and(Actions::alertSound(3, 300)->render())->toBe('PlayAlertSound 3 300')
        ->and(Actions::alertSound(3)->render())->toBe('PlayAlertSound 3')
        ->and(Actions::disableDropSound()->render())->toBe('DisableDropSound');
});

test('action arguments are range-validated', function () {
    expect(fn () => Actions::fontSize(46))->toThrow(InvalidArgumentException::class)
        ->and(fn () => Actions::minimapIcon(3, FilterColor::Red, MinimapShape::Circle))->toThrow(InvalidArgumentException::class)
        ->and(fn () => Actions::alertSound(17))->toThrow(InvalidArgumentException::class);
});

test('a block renders its keyword, comment, tab-indented lines and Continue', function () {
    $block = FilterBlock::show('currency: top')
        ->when(Conditions::rarity(Rarity::Unique), Conditions::baseType('Silk Robe'))
        ->style(Actions::fontSize(45), Actions::textColor(new Color(0, 0, 0)))
        ->continueMatching();

    expect($block->render())->toBe(implode("\n", [
        'Show # currency: top',
        "\tRarity Unique",
        "\tBaseType == \"Silk Robe\"",
        "\tSetFontSize 45",
        "\tSetTextColor 0 0 0 255",
        "\tContinue",
    ]));
});

test('an empty block is a match-all', function () {
    expect(FilterBlock::hide()->render())->toBe('Hide');
});

test('a document renders a header banner and blank-line-separated blocks with a trailing newline', function () {
    $document = new FilterDocument("Generated by Exile to Exile\nLeague: Runes of Aldur")
        ->add(
            FilterBlock::show()->when(Conditions::baseType('Divine Orb'))->style(Actions::fontSize(40)),
            FilterBlock::hide(),
        );

    expect($document->render())->toBe(implode("\n", [
        '# Generated by Exile to Exile',
        '# League: Runes of Aldur',
        '',
        'Show',
        "\tBaseType == \"Divine Orb\"",
        "\tSetFontSize 40",
        '',
        'Hide',
        '',
    ]));
});
