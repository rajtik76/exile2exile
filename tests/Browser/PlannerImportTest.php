<?php

declare(strict_types=1);

test('importing a PoB build lands the author in the editor, not the class gallery', function () {
    $code = file_get_contents(dirname(__DIR__, 2).'/resources/pob/poe2/witch-lvl80-runes-of-aldur-league.txt');

    $page = visit(route('planner.create'));

    // The create page opens on the class gallery with an import button; clicking it
    // opens the import modal.
    $page->assertSee('Choose your class')
        ->click('Import from Path of Building')
        ->fill('code', $code)
        ->click('Import build')
        // The import redirects into the editor for the freshly created plan: the class
        // gate is gone and the editor chrome (build description + New build) is shown.
        // This guards the create→edit component-reuse bug where the editor kept the
        // create page's blank build and fell back to the gallery.
        ->assertNoJavaScriptErrors()
        ->assertDontSee('Choose your class')
        ->assertSee('New build')
        ->assertSee('Build description');
});
