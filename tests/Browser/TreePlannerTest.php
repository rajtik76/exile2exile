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

/*
 * Characterization snapshot for the tree canvas itself: it pins the rendered
 * scene (node sprites, connections, frames, centre art) so a change inside
 * @poe2-toolkit/tree-react that alters rendering shows up as a visual diff.
 * The canvas paints asynchronously after the sprite atlases decode, so the
 * test waits for the point gauge (data loaded) and a settle beat for the
 * atlas textures to upload before comparing.
 *
 * No snapshot of the search highlight: its rings pulse (animated alpha and
 * radius), so a screenshot of them can never be deterministic. The search
 * behaviour itself is asserted textually above.
 */

test('the default tree view matches its visual snapshot', function () {
    visit(route('tree'))
        ->assertNoJavaScriptErrors()
        ->assertSee('/123')
        ->wait(3)
        ->assertScreenshotMatches();
});
