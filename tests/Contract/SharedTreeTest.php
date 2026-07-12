<?php

use App\Models\SharedTree;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;

/**
 * A valid allocation payload. Node ids are real entries in the current tree, so
 * the integrity check in ShareTreeRequest passes.
 */
function shareableBuild(array $overrides = []): array
{
    return array_merge([
        'className' => 'Witch',
        'ascendId' => 'Witch1',
        'allocated' => [4, 16, 30],
        'attributeChoices' => [4 => 'int'],
        'jewels' => [],
        'treeVersion' => '0_5',
    ], $overrides);
}

/** A saved tree with its edit token minted, as the store action creates them. */
function makeSharedTree(array $overrides = []): SharedTree
{
    return SharedTree::create(array_merge([
        'slug' => Str::random(12),
        'edit_token' => Str::random(64),
        'build' => shareableBuild(),
    ], $overrides));
}

/** A share from before the edit flow existed: no token, read-only forever. */
function makeLegacyBuild(array $overrides = []): SharedTree
{
    return makeSharedTree(array_merge(['edit_token' => null], $overrides));
}

/*
 * Saving - every save mints its own row, edit token and unlocked session.
 */

test('saving a tree stores it, unlocks the session and redirects to the editor without a token in the url', function () {
    $response = $this->post(route('shared.store'), shareableBuild());

    $shared = SharedTree::sole();

    $response->assertRedirect(route('shared.edit', ['sharedTree' => $shared->slug]));

    expect($shared->build->className)->toBe('Witch')
        ->and($shared->build->ascendId)->toBe('Witch1')
        ->and($shared->build->allocation->allocated)->toBe([4, 16, 30])
        ->and($shared->edit_token)->not->toBeNull()
        ->and(strlen((string) $shared->edit_token))->toBe(64)
        // The author lands straight in the editor: the session already holds
        // the verified token, and the redirect URL never carries it.
        ->and(session($shared->unlockSessionKey()))->toBe($shared->edit_token);
});

test('identical trees no longer collapse to one row - each save owns its link and token', function () {
    // Shares used to be content-addressed, but an editable row belongs to whoever
    // holds its token: two authors saving the same tree must never converge on
    // the same link (the second would inherit the first author's edit rights).
    $this->post(route('shared.store'), shareableBuild());
    $this->post(route('shared.store'), shareableBuild());

    $builds = SharedTree::all();

    expect($builds)->toHaveCount(2)
        ->and($builds[0]->slug)->not->toBe($builds[1]->slug)
        ->and($builds[0]->edit_token)->not->toBe($builds[1]->edit_token);
});

test('saving stores weapon-set assignments', function () {
    $this->post(route('shared.store'), shareableBuild([
        'weaponSets' => [16 => 1, 30 => 2],
    ]));

    expect(SharedTree::sole()->build->allocation->weaponSets)->toBe([16 => 1, 30 => 2]);
});

test('a weapon set on an unallocated node is dropped', function () {
    // 999 is not in `allocated`, so its assignment must not be stored.
    $this->post(route('shared.store'), shareableBuild([
        'allocated' => [4, 16, 30],
        'weaponSets' => [30 => 1, 999 => 2],
    ]));

    expect(SharedTree::sole()->build->allocation->weaponSets)->toBe([30 => 1]);
});

test('an invalid weapon set value is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['weaponSets' => [30 => 3]]))
        ->assertInvalid(['weaponSets.30']);

    expect(SharedTree::count())->toBe(0);
});

test('a build allocating a node outside the tree is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['allocated' => [999999999]]))
        ->assertInvalid(['allocated']);

    expect(SharedTree::count())->toBe(0);
});

test('a save without a class is rejected', function () {
    $this->postJson(route('shared.store'), shareableBuild(['className' => '']))
        ->assertInvalid(['className']);
});

/*
 * The read-only viewer - and what it must never leak.
 */

test('the viewer renders a shared build by its slug and never exposes the edit token', function () {
    $shared = makeSharedTree(['slug' => 'abc123XYZ789']);

    $this->get(route('shared.show', $shared))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree/shared')
            ->where('slug', 'abc123XYZ789')
            ->where('build.className', 'Witch')
            ->where('build.ascendId', 'Witch1')
            ->missing('editToken')
        )
        // The secret must not appear anywhere in the page payload.
        ->assertDontSee($shared->edit_token);
});

test('a legacy pre-token share still renders in the viewer', function () {
    $shared = makeLegacyBuild();

    $this->get(route('shared.show', $shared))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree/shared')
            ->where('build.className', 'Witch')
        );
});

test('the json document never exposes the edit token', function () {
    $shared = makeSharedTree();

    $this->get(route('shared.json', ['slug' => $shared->slug]))
        ->assertOk()
        ->assertDontSee($shared->edit_token);
});

test('viewing a shared build records the visit', function () {
    $shared = makeSharedTree();

    expect($shared->last_viewed_at)->toBeNull();

    $this->get(route('shared.show', $shared))->assertOk();

    expect($shared->fresh()->last_viewed_at)->not->toBeNull();
});

test('an unknown slug 404s', function () {
    $this->get('/t/does-not-exist')->assertNotFound();
});

/*
 * The editor gate - the unlock form guards the edit page.
 */

test('the editor shows the unlock form until the session is unlocked', function () {
    $shared = makeSharedTree();

    $this->get(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree/unlock')
            ->where('slug', $shared->slug)
            ->where('className', 'Witch')
            ->missing('editToken')
        )
        // The locked gate must not carry the secret anywhere in its payload.
        ->assertDontSee($shared->edit_token);
});

test('the editor renders once the session is unlocked, with the token exposed only to its author', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->get(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('mode', 'edit')
            ->where('slug', $shared->slug)
            ->where('editToken', $shared->edit_token)
            ->where('initialBuild.className', 'Witch')
            ->where('initialBuild.allocated', [4, 16, 30])
        );
});

test('a stale unlock does not open the editor after the token rotated', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => 'stale-token'])
        ->get(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->assertInertia(fn (AssertableInertia $page) => $page->component('tree/unlock'));
});

test('a legacy share has no editor and bounces to the viewer', function () {
    $shared = makeLegacyBuild();

    $this->get(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->assertRedirect(route('shared.show', ['sharedTree' => $shared->slug]));
});

test('an unknown slug has no editor', function () {
    $this->get('/t/doesnotexist/edit')->assertNotFound();
});

/*
 * Unlocking - the token travels once, in the POST body.
 */

test('unlock verifies the token in the body and opens the editor', function () {
    $shared = makeSharedTree();

    $this->post(route('shared.unlock', ['sharedTree' => $shared->slug]), ['token' => $shared->edit_token])
        ->assertRedirect(route('shared.edit', ['sharedTree' => $shared->slug]));

    expect(session($shared->unlockSessionKey()))->toBe($shared->edit_token);
});

test('unlock requires a token', function () {
    $shared = makeSharedTree();

    $this->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->post(route('shared.unlock', ['sharedTree' => $shared->slug]), [])
        ->assertSessionHasErrors('token');

    expect(session($shared->unlockSessionKey()))->toBeNull();
});

test('unlock rejects a wrong token without unlocking', function () {
    $shared = makeSharedTree();

    $this->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->post(route('shared.unlock', ['sharedTree' => $shared->slug]), ['token' => 'wrong'])
        ->assertSessionHasErrors('token');

    expect(session($shared->unlockSessionKey()))->toBeNull();
});

test('unlock hard-locks after three wrong tokens', function () {
    $shared = makeSharedTree();

    foreach (range(1, 3) as $attempt) {
        $this->from(route('shared.edit', ['sharedTree' => $shared->slug]))
            ->post(route('shared.unlock', ['sharedTree' => $shared->slug]), ['token' => 'wrong'])
            ->assertSessionHasErrors('token');
    }

    // Even the right token bounces during the cool-off.
    $this->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->post(route('shared.unlock', ['sharedTree' => $shared->slug]), ['token' => $shared->edit_token])
        ->assertSessionHasErrors('token');

    expect(session($shared->unlockSessionKey()))->toBeNull();
});

test('a legacy share cannot be unlocked - there is no token to match', function () {
    $shared = makeLegacyBuild();

    // Any guess must 404, so a legacy row can never be edited into.
    $this->post(route('shared.unlock', ['sharedTree' => $shared->slug]), ['token' => ''])
        ->assertNotFound();
});

/*
 * Updating - only through the unlocked session.
 */

test('an edit is saved once the session is unlocked', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->put(route('shared.update', ['sharedTree' => $shared->slug]), shareableBuild(['allocated' => [4, 16]]))
        ->assertRedirect(route('shared.edit', ['sharedTree' => $shared->slug]));

    expect($shared->fresh()->build->allocation->allocated)->toBe([4, 16]);
});

test('an edit without an unlocked session is forbidden even with the token in the body', function () {
    $shared = makeSharedTree();

    // The token has no business in an update payload - authorization rides only
    // on the unlocked session, so a leaked token pasted into a raw PUT does nothing.
    $this->put(
        route('shared.update', ['sharedTree' => $shared->slug]),
        shareableBuild(['allocated' => [4, 16]]) + ['token' => $shared->edit_token],
    )->assertForbidden();

    expect($shared->fresh()->build->allocation->allocated)->toBe([4, 16, 30]);
});

test('a stale unlock cannot save an edit after the token rotated', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => 'stale-token'])
        ->put(route('shared.update', ['sharedTree' => $shared->slug]), shareableBuild(['allocated' => [4, 16]]))
        ->assertForbidden();
});

test('an unlocked but invalid edit fails validation without saving', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->putJson(route('shared.update', ['sharedTree' => $shared->slug]), shareableBuild(['allocated' => [999999999]]))
        ->assertInvalid(['allocated']);

    expect($shared->fresh()->build->allocation->allocated)->toBe([4, 16, 30]);
});

test('an edit refreshes the cached build document', function () {
    $shared = makeSharedTree();

    // Prime the forever-cache with the original document.
    $this->get(route('shared.json', ['slug' => $shared->slug]))
        ->assertOk()
        ->assertJsonPath('passives.pointsAllocated', 3);

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->put(route('shared.update', ['sharedTree' => $shared->slug]), shareableBuild(['allocated' => [4, 16]]));

    // The stale entry was dropped on update: the document reflects the edit.
    $this->get(route('shared.json', ['slug' => $shared->slug]))
        ->assertOk()
        ->assertJsonPath('passives.pointsAllocated', 2);
});

/*
 * Deleting - double-gated by the unlocked session AND the re-typed token.
 */

test('deleting a build verifies the re-typed token and removes it for good', function () {
    $shared = makeSharedTree();

    // Prime the document cache, so the delete provably clears it too.
    $this->get(route('shared.json', ['slug' => $shared->slug]))->assertOk();

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), ['token' => $shared->edit_token])
        ->assertRedirect(route('tree'));

    expect(SharedTree::count())->toBe(0)
        // The unlock is gone with the build - nothing secret lingers in the session.
        ->and(session($shared->unlockSessionKey()))->toBeNull();

    // The public page and the document are gone with it - nothing serves from cache.
    $this->get(route('shared.show', ['sharedTree' => $shared->slug]))->assertNotFound();
    $this->get(route('shared.json', ['slug' => $shared->slug]))->assertNotFound();
});

test('deleting without an unlocked session is forbidden even with the right token', function () {
    $shared = makeSharedTree();

    // The public slug plus a stolen token alone must not destroy anything: the
    // delete form only exists inside the unlocked editor.
    $this->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), ['token' => $shared->edit_token])
        ->assertForbidden();

    expect(SharedTree::count())->toBe(1);
});

test('deleting with a wrong token keeps the build and never flashes the secret', function () {
    $shared = makeSharedTree();

    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), ['token' => 'wrong'])
        ->assertRedirect(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->assertSessionHasErrors('token');

    expect(SharedTree::count())->toBe(1);
});

test('a missing token never lands in the old-input session flash', function () {
    $shared = makeSharedTree();

    // A validation failure flashes old input for the redirect back - the token field
    // is excluded, so the secret is never persisted in the session flash.
    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), [])
        ->assertSessionHasErrors('token')
        ->assertSessionMissing('_old_input.token');

    expect(SharedTree::count())->toBe(1);
});

test('deleting hard-locks after three wrong tokens', function () {
    $shared = makeSharedTree();

    foreach (range(1, 3) as $attempt) {
        $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
            ->from(route('shared.edit', ['sharedTree' => $shared->slug]))
            ->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), ['token' => 'wrong'])
            ->assertSessionHasErrors('token');
    }

    // Even the right token bounces during the cool-off.
    $this->withSession([$shared->unlockSessionKey() => $shared->edit_token])
        ->from(route('shared.edit', ['sharedTree' => $shared->slug]))
        ->delete(route('shared.destroy', ['sharedTree' => $shared->slug]), ['token' => $shared->edit_token])
        ->assertSessionHasErrors('token');

    expect(SharedTree::count())->toBe(1);
});

/*
 * Seeding the /tree planner from a shared build.
 */

test('the planner opens seeded from a shared build via ?from', function () {
    $shared = makeSharedTree(['slug' => 'seedme12345A']);

    $this->get(route('tree', ['from' => $shared->slug]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('mode', 'create')
            ->where('initialBuild.className', 'Witch')
            ->where('initialBuild.allocated', [4, 16, 30])
            // A snapshot seed is not an edit session: no token comes with it.
            ->where('editToken', null)
        )
        ->assertDontSee($shared->edit_token);
});

test('the planner opens empty without a from slug', function () {
    $this->get(route('tree'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('mode', 'create')
            ->where('initialBuild', null)
        );
});

test('an unknown from slug opens the planner empty', function () {
    $this->get(route('tree', ['from' => 'nope']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('tree')
            ->where('initialBuild', null)
        );
});
