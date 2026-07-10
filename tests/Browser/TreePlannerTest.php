<?php

test('the passive tree planner renders with its editing controls', function () {
    $page = visit(route('tree'));

    $page->assertNoJavaScriptErrors()
        ->assertNoConsoleLogs()
        // Editable-mode chrome: the importer, the on-stage class picker and the
        // basic point-budget gauge read-out (GGPK-derived 123-point cap).
        ->assertSee('Load build')
        ->assertSee('Witch')
        ->assertSee('/123')
        // The combined budget bar: the "Points" label, the paint segments and
        // the weapon-set counters (24-point cap, shown for set I and II).
        ->assertSee('Points')
        ->assertSee('/24');
});

test('searching by node name reports matches and stays error-free', function () {
    $page = visit(route('tree'));

    // Wait for the async tree data, then search a name common in the tree.
    $page->assertSee('Witch')
        ->fill('node-search', 'Life')
        ->assertSee('hits')
        ->assertNoJavaScriptErrors();
});
