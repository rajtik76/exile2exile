<?php

declare(strict_types=1);

use Database\Seeders\PlanSeeder;

/**
 * The passive tree is by far the heaviest thing a build guide can pull: the normalised
 * tree JSON (~400 kB gzipped, ~1.9 MB parsed) plus several MB of GGG sprite atlases. It
 * sits far below the fold, so none of it may be fetched until the reader actually scrolls
 * to it.
 *
 * These two tests pin exactly that, end to end in a real browser, because it is the one
 * property that is invisible in the UI: a page-level `useTreeData()` call anywhere on the
 * viewer (the shape this had before) looks identical on screen while starting the whole
 * download on mount. Only a network trace tells the difference - so that is what is
 * asserted here.
 *
 * jsdom cannot cover it: it ships no `IntersectionObserver`, so `LazyMount` there mounts
 * immediately by design. The unit test in `PlannerTree.test.tsx` stubs the observer to
 * pin the same invariant; this is its real-browser counterpart.
 *
 * Note the browser suite runs neither in CI nor in the commit hook (see the workflows and
 * `composer review`), so this is a deliberate, locally-run gate - and it needs the real
 * extracted game data, like every `visit()` of a tree page.
 */

/**
 * Everything the tree renderer fetches for itself. Deliberately spelled out rather than
 * pattern-matched: if the extractor starts shipping another atlas, this list should fail
 * to cover it and be updated on purpose.
 *
 * @return list<string>
 */
function treeRendererPayload(): array
{
    return [
        '/tree/current/data.json',
        '/tree/current/assets/skills.json',
        '/tree/current/assets/skills.webp',
        '/tree/current/assets/frame.json',
        '/tree/current/assets/frame.webp',
        '/tree/current/assets/mastery-effect-active.json',
        '/tree/current/assets/mastery-effect-active.webp',
    ];
}

/**
 * A JS expression that watches the page for a while, then reports what it fetched under
 * `/tree/current/` (from the Resource Timing API - the browser's own record, so a cached
 * response still counts as "was fetched"), whether a canvas got mounted, and where the
 * page is scrolled.
 *
 * The waiting is the whole point of this helper. A resource-timing entry only appears once
 * the response has *finished*, so reading straight after the first paint reports an empty
 * list even when the tree data is already in flight - verified by mutation, an earlier
 * version of this test passed against a deliberately broken deferral for exactly that
 * reason.
 *
 * Two bounds, because neither alone is enough:
 *  - a minimum watch window, since going quiet proves nothing while a slow request is
 *    still open (an in-flight fetch is invisible to this API, so "no new entries" can mean
 *    "nothing is loading" *or* "something big is still downloading");
 *  - a quiet period after that, so a fast machine does not pay the whole window.
 */
function settledPageState(): string
{
    return <<<'JS'
    (async () => {
        const paths = () => new Set(
            performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
        );
        const watchAtLeast = 3000;
        const idleFor = 750;
        const startedAt = Date.now();
        const deadline = startedAt + 10000;
        let count = paths().size;
        let quietSince = Date.now();

        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));

            if (paths().size !== count) {
                count = paths().size;
                quietSince = Date.now();

                continue;
            }

            if (Date.now() - startedAt >= watchAtLeast && Date.now() - quietSince >= idleFor) {
                break;
            }
        }

        return {
            treePaths: [...paths()].filter((path) => path.startsWith('/tree/current/')).sort(),
            canvases: document.querySelectorAll('canvas').length,
            scrollY: Math.round(window.scrollY),
        };
    })()
    JS;
}

beforeEach(function () {
    // build1 is the seeder's Warrior/Titan guide: a full six-phase plan with an allocated
    // tree, so the tree section has something real to draw.
    $this->seed(PlanSeeder::class);
});

test('opening a build guide fetches no passive-tree data while the tree is off screen', function () {
    $page = visit(route('planner.show', ['plan' => 'build1']));

    $page->assertSee('Build guide')->assertNoJavaScriptErrors();

    $state = $page->script(settledPageState());

    // The class/ascendancy portrait is the one legitimate exception: it is the page's
    // faded backdrop, above the fold, and its name is resolved server-side precisely so
    // it needs no tree download. Anything else under /tree/current/ - the tree data, the
    // node atlases, the hub ring textures - means the deferral broke.
    $unexpected = array_values(array_filter(
        $state['treePaths'],
        fn (string $path): bool => preg_match('#^/tree/current/assets/centre/(portrait|ascendancy)-[a-z0-9-]+\.webp$#', $path) !== 1,
    ));

    expect($unexpected)->toBe([])
        // The backdrop really is there, so the assertion above passed for the right
        // reason rather than because the page rendered nothing at all.
        ->and($state['treePaths'])->not->toBeEmpty()
        // The canvas the atlases feed is not mounted either.
        ->and($state['canvases'])->toBe(0)
        // And none of this was measured after an accidental scroll.
        ->and($state['scrollY'])->toBe(0);
});

test('scrolling the passive tree into view loads the tree and all its atlases', function () {
    $page = visit(route('planner.show', ['plan' => 'build1']));

    $page->assertSee('Build guide')->assertCount('canvas', 0);

    $page->script('window.scrollTo({ top: document.body.scrollHeight })');

    // Wait for both halves of "it loaded", in one place: every file in the payload
    // present in the browser's own resource log, AND a mounted canvas. Neither alone is
    // enough - the canvas appears as soon as the tree JSON lands, while the atlases are
    // still in flight, and the atlases finish downloading before the renderer has decoded
    // them into a scene. On a timeout the result names what was still missing, so a
    // failure points at the file rather than just saying "0 canvases".
    $poll = <<<'JS'
    (async () => {
        const want = WANTED;
        const seen = () => new Set(
            performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
        );
        const state = () => ({
            missing: want.filter((path) => !seen().has(path)),
            canvases: document.querySelectorAll('canvas').length,
        });
        const deadline = Date.now() + 15000;

        for (;;) {
            const current = state();

            if (current.missing.length === 0 && current.canvases > 0) {
                return current;
            }

            if (Date.now() >= deadline) {
                return current;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    })()
    JS;

    // The payload list is injected from PHP so it lives in exactly one place.
    $loaded = $page->script(str_replace(
        'WANTED',
        json_encode(treeRendererPayload(), JSON_THROW_ON_ERROR),
        $poll,
    ));

    expect($loaded['missing'])->toBe([])
        ->and($loaded['canvases'])->toBe(1);

    // And the notable-priority list under the canvas came up too - it reads node names
    // out of the same extract, and was the second thing holding this download eager.
    $page->assertSee('Notables and keystones')
        ->assertNoJavaScriptErrors();
});
