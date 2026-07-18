<?php

declare(strict_types=1);

test('the Swap toggle shows the swap weapon set in the same doll cells', function () {
    // This build's import carries a swap-set main weapon (weapon1swap) but no swap
    // off-hand - so "Off-hand (Swap)" is a genuinely empty slot, showing its label,
    // while the primary "Off-hand" cell it replaces is not.
    $code = file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/warrior-lvl100-twice-corrupted-sanctified.txt');

    $page = visit(route('planner.create'));

    $page->click('Import from Path of Building')
        ->fill('code', $code)
        ->click('Import build')
        ->assertNoJavaScriptErrors()
        // The doll shows the primary set's slot labels by default.
        ->assertDontSee('Off-hand (Swap)')
        ->click('II')
        // Switching to the swap set relabels the empty off-hand cell.
        ->assertSee('Off-hand (Swap)')
        ->click('I')
        // Switching back restores the primary set's labels.
        ->assertDontSee('Off-hand (Swap)')
        ->assertNoJavaScriptErrors();
});
