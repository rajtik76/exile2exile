<?php

use App\Models\SharedBuild;
use Illuminate\Support\Str;

/**
 * The saved-tree editor's link panel, end to end: unlock with the real token,
 * then copy the public link, the edit link and the token from their buttons.
 *
 * The browser context has no clipboard permission, so navigator.clipboard is
 * replaced with a capturing stub before the clicks - the test then asserts both
 * the user-visible "Copied ✓" feedback and the exact strings handed to the
 * clipboard, without depending on headless clipboard support.
 */
function makeEditableTree(): SharedBuild
{
    return SharedBuild::create([
        'slug' => Str::random(12),
        'edit_token' => Str::random(64),
        'build' => [
            'className' => 'Witch',
            'ascendId' => 'Witch1',
            'allocated' => [4, 16, 30],
            'attributeChoices' => [4 => 'int'],
            'jewels' => [],
            'treeVersion' => '0_5',
        ],
    ]);
}

test('the editor panel copies the public link, the edit link and the token', function () {
    $shared = makeEditableTree();

    // The edit URL is gated: unlock with the real token first, like the author would.
    $page = visit(route('shared.edit', ['sharedBuild' => $shared->slug]));

    $page->assertSee('Unlock to edit')
        ->assertDontSee($shared->edit_token)
        ->fill('token', $shared->edit_token)
        ->click('Unlock')
        // The editor opens with the link panel already unfolded.
        ->waitForText('Build links');

    // Capture instead of the real clipboard (headless contexts deny the API).
    $page->script(<<<'JS'
        (() => {
            window.__copied = [];
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: (text) => {
                        window.__copied.push(text);

                        return Promise.resolve();
                    },
                },
            });
        })()
    JS);

    $page->click('[aria-label="Copy public link"]')
        ->assertSee('Copied ✓')
        ->click('[aria-label="Copy edit link"]')
        ->assertSee('Copied ✓')
        ->click('[aria-label="Copy edit token"]')
        ->assertSee('Copied ✓')
        ->assertNoJavaScriptErrors();

    // Playwright may re-dispatch a click it saw interrupted, so assert on the
    // distinct copied strings, not the raw call count.
    $copied = array_values(array_unique($page->script('window.__copied')));

    expect($copied)->toHaveCount(3)
        ->and($copied[0])->toEndWith("/t/{$shared->slug}")
        ->and($copied[1])->toEndWith("/t/{$shared->slug}/edit")
        ->and($copied[2])->toBe($shared->edit_token);
});
