<?php

/**
 * Golden frame positions for every class/ascendancy, written out by hand (not
 * derived from the helper) so the test pins the mapping rather than mirroring
 * it. Each sheet is a 1500px grid in reading order; Witch is 3 columns wide,
 * every other class is 2.
 *
 * @return list<array{0: string, 1: ?string, 2: int, 3: int}> [class, ascendancy, x, y]
 */
function portraitExpectations(): array
{
    return [
        ['warrior', null, 0, 0],
        ['warrior', 'Titan', 1500, 0],
        ['warrior', 'Warbringer', 0, 1500],
        ['warrior', 'Smith of Kitava', 1500, 1500],

        ['witch', null, 0, 0],
        ['witch', 'Infernalist', 1500, 0],
        ['witch', 'Blood Mage', 3000, 0],
        ['witch', 'Lich', 0, 1500],
        ['witch', 'Abyssal Lich', 1500, 1500],

        ['ranger', null, 0, 0],
        ['ranger', 'Deadeye', 1500, 0],
        ['ranger', 'Pathfinder', 1500, 1500],

        ['sorceress', null, 0, 0],
        ['sorceress', 'Stormweaver', 1500, 0],
        ['sorceress', 'Chronomancer', 0, 1500],
        ['sorceress', 'Disciple of Varashta', 1500, 1500],

        ['huntress', null, 0, 0],
        ['huntress', 'Amazon', 1500, 0],
        ['huntress', 'Spirit Walker', 0, 1500],
        ['huntress', 'Ritualist', 1500, 1500],

        ['mercenary', null, 0, 0],
        ['mercenary', 'Tactician', 1500, 0],
        ['mercenary', 'Witchhunter', 0, 1500],
        ['mercenary', 'Gemling Legionnaire', 1500, 1500],

        ['monk', null, 0, 0],
        ['monk', 'Martial Artist', 1500, 0],
        ['monk', 'Invoker', 0, 1500],
        ['monk', 'Acolyte of Chayula', 1500, 1500],

        ['druid', null, 0, 0],
        ['druid', 'Oracle', 1500, 0],
        ['druid', 'Shaman', 0, 1500],
    ];
}

test('every class and ascendancy portrait maps to the correct sprite frame', function () {
    $page = visit(route('test.class-portraits'));

    $page->assertNoJavaScriptErrors()->assertNoConsoleLogs();

    // Portraits are now individual GGPK images (centre/portrait-<class> for the
    // base class, centre/ascendancy-<slug> for an ascendancy), so the whole-image
    // rect is always 0,0 and the file is keyed by name.
    foreach (portraitExpectations() as [$class, $ascendancy]) {
        $arg = $ascendancy === null ? 'null' : "'{$ascendancy}'";
        $file = $ascendancy === null
            ? "portrait-{$class}"
            : 'ascendancy-'.trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($ascendancy)), '-');

        expect($page->script("window.__portrait('{$class}', {$arg}).rect.x"))->toBe(0);
        expect($page->script("window.__portrait('{$class}', {$arg}).src"))
            ->toContain("centre/{$file}");
    }
});

test('the class portrait sheet matches its visual snapshot', function () {
    // The page preloads ~30 individual 1500² portrait webps and only renders the
    // grid (with its captions) once they're decoded, so waiting for a caption
    // guarantees everything is painted before the screenshot - avoids the
    // parallel-run flakiness a fixed wait still left.
    visit(route('test.class-portraits'))
        ->assertNoJavaScriptErrors()
        ->assertSee('Titan')
        ->assertScreenshotMatches();
});
