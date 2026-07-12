<?php

use App\Http\Controllers\ChangelogController;
use App\Http\Controllers\FilterController;
use App\Http\Controllers\NewsletterSubscriberController;
use App\Http\Controllers\PlannerController;
use App\Http\Controllers\PlannerReferenceController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\SharedTreeController;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\TreeController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Plain-text SEO descriptors, rendered from APP_URL and named routes (no hardcoded host).
Route::get('robots.txt', [SeoController::class, 'robots']);
Route::get('llms.txt', [SeoController::class, 'llms']);

Route::inertia('privacy', 'privacy')->name('privacy');
Route::inertia('terms', 'terms')->name('terms');
Route::inertia('credits', 'credits')->name('credits');

// Key changes, parsed from the repo's CHANGELOG.md.
Route::get('changelog', ChangelogController::class)->name('changelog');

// Download a generated in-game loot filter (public; built from local data, never a live
// API call). `economy` is the value-only layer; `build` adds a build's own overlay on top,
// resolved by the plan's public slug. Throttled as generation endpoints.
Route::get('filter/economy', [FilterController::class, 'economy'])
    ->middleware('throttle:30,1')
    ->name('filter.economy');
Route::get('filter/build/{plan:slug}', [FilterController::class, 'build'])
    ->middleware('throttle:30,1')
    ->name('filter.build');
// Sample labels for the on-page filter preview (JSON), read from the vendored NeverSink file.
Route::get('filter/preview', [FilterController::class, 'preview'])
    ->middleware('throttle:60,1')
    ->name('filter.preview');

// Developer docs for the public "new PoE2 patch" webhook (API lives in routes/api.php).
Route::inertia('patch-webhook', 'patch-webhook')->name('patch-webhook');

// Build planner - a guest authors and saves a build guide under a public slug,
// editable only with the secret token minted at creation (no accounts). Store and
// update are throttled per IP (guest writes). Edit/update routes carry the token;
// the read viewer needs only the slug.
Route::get('build-planner', [PlannerController::class, 'create'])->name('planner.create');
Route::post('build-planner', [PlannerController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('planner.store');
// Import a PoB export code / pobb.in link into a fresh plan (decoded and mapped
// server-side). Throttled per IP - it resolves and may fetch a pobb.in link.
Route::post('build-planner/import', [PlannerController::class, 'import'])
    ->middleware('throttle:10,1')
    ->name('planner.import');
// Catalogue endpoints for the inline-reference picker (gems/runes/uniques).
// Declared before the slug viewer so the literal "references" segment isn't
// swallowed as a slug. `resolve` turns tokens back into live data on editor load,
// so the client never persists resolved references (only the token id).
Route::get('build-planner/references', [PlannerReferenceController::class, 'search'])
    ->middleware('throttle:60,1')
    ->name('planner.references');
Route::post('build-planner/references/resolve', [PlannerReferenceController::class, 'resolve'])
    ->middleware('throttle:60,1')
    ->name('planner.references.resolve');
// The item modifier picker: search the affixes a base can roll (grouped tier ladders),
// and resolve stored mod ids back to their live tier lines on editor load.
Route::get('build-planner/mods', [PlannerReferenceController::class, 'mods'])
    ->middleware('throttle:60,1')
    ->name('planner.mods');
Route::post('build-planner/mods/resolve', [PlannerReferenceController::class, 'resolveMods'])
    ->middleware('throttle:60,1')
    ->name('planner.mods.resolve');
Route::get('build-planner/{plan:slug}', [PlannerController::class, 'show'])
    ->whereAlphaNumeric('slug')
    ->name('planner.show');
Route::get('build-planner/{plan:slug}/edit', [PlannerController::class, 'edit'])
    ->whereAlphaNumeric('slug')
    ->name('planner.edit');
// Verify the secret edit token (submitted in the form body, never a URL) and unlock the
// editor for this session. Throttled per IP so the token can't be brute-forced.
Route::post('build-planner/{plan:slug}/unlock', [PlannerController::class, 'unlock'])
    ->middleware('throttle:10,1')
    ->whereAlphaNumeric('slug')
    ->name('planner.unlock');
Route::put('build-planner/{plan:slug}', [PlannerController::class, 'update'])
    ->middleware('throttle:20,1')
    ->whereAlphaNumeric('slug')
    ->name('planner.update');

// Delete a build. The edit token is re-typed into the delete form and travels only in
// the request body (never a URL); throttled per IP like the unlock form.
Route::delete('build-planner/{plan:slug}', [PlannerController::class, 'destroy'])
    ->middleware('throttle:10,1')
    ->whereAlphaNumeric('slug')
    ->name('planner.destroy');

// First-party, cookieless analytics dashboard. No login system yet, so it sits
// behind HTTP Basic Auth (STATS_USER / STATS_PASS) instead of the auth guard.
Route::get('stats', [StatsController::class, 'index'])
    ->middleware('stats.auth')
    ->name('stats');

// Public page for building the new data-driven passive-tree renderer. `?from={slug}`
// seeds it with a shared build's allocation so the user can edit it as a snapshot.
Route::get('tree', [TreeController::class, 'index'])->name('tree');
// Decode a PoB code/pobb.in link into the renderer's allocation (class +
// ascendancy + allocated node ids).
Route::post('tree/allocation', [TreeController::class, 'allocation'])->name('tree.allocation');
// Save the current passive-tree allocation under a public slug and mint its secret
// edit token - same guest model as the build planner. Throttled per IP (guest
// action, no auth) so the endpoint can't be hammered to fill the table.
Route::post('tree/share', [SharedTreeController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('shared.store');
// The machine-readable build document (class, ascendancy, named passives) for a
// shared build. Declared before the HTML viewer so the `.json` suffix wins, and
// the viewer's slug is constrained to alphanumerics so it never swallows it.
// Plain slug, not route-model binding: showJson serves a cached document and
// only touches the DB on a cache miss, so a hot build never re-reads the row.
Route::get('t/{slug}.json', [SharedTreeController::class, 'showJson'])
    ->whereAlphaNumeric('slug')
    ->name('shared.json');
// The read-only viewer for a shared build, resolved by its public slug.
Route::get('t/{sharedTree}', [SharedTreeController::class, 'show'])
    ->whereAlphaNumeric('sharedTree')
    ->name('shared.show');
// The editor for a saved tree. Shows the unlock form until the session holds the
// verified edit token; legacy token-less shares bounce back to the viewer.
Route::get('t/{sharedTree}/edit', [SharedTreeController::class, 'edit'])
    ->whereAlphaNumeric('sharedTree')
    ->name('shared.edit');
// Verify the secret edit token (submitted in the form body, never a URL) and unlock
// the editor for this session. Throttled per IP so the token can't be brute-forced.
Route::post('t/{sharedTree}/unlock', [SharedTreeController::class, 'unlock'])
    ->middleware('throttle:10,1')
    ->whereAlphaNumeric('sharedTree')
    ->name('shared.unlock');
Route::put('t/{sharedTree}', [SharedTreeController::class, 'update'])
    ->middleware('throttle:20,1')
    ->whereAlphaNumeric('sharedTree')
    ->name('shared.update');
// Delete a saved tree. The edit token is re-typed into the delete form and travels
// only in the request body (never a URL); throttled per IP like the unlock form.
Route::delete('t/{sharedTree}', [SharedTreeController::class, 'destroy'])
    ->middleware('throttle:10,1')
    ->whereAlphaNumeric('sharedTree')
    ->name('shared.destroy');

// Newsletter signup with double opt-in. Confirm and unsubscribe are signed,
// per-subscriber links sent by email: GET for humans, and unsubscribe also
// accepts POST for RFC 8058 one-click unsubscribe from mail providers. A link
// used after the row is gone (double click) still lands on the status page.
Route::get('newsletter', [NewsletterSubscriberController::class, 'create'])->name('newsletter.create');
Route::post('newsletter', [NewsletterSubscriberController::class, 'store'])
    ->middleware('throttle:10,1')
    ->name('newsletter.store');
Route::get('newsletter/confirm/{subscriber}', [NewsletterSubscriberController::class, 'confirm'])
    ->middleware(['signed', 'throttle:30,1'])
    ->name('newsletter.confirm');
Route::match(['get', 'post'], 'newsletter/unsubscribe/{subscriber}', [NewsletterSubscriberController::class, 'unsubscribe'])
    ->middleware(['signed', 'throttle:30,1'])
    ->missing(fn () => redirect()->route('newsletter.create')->with('newsletter.status', 'unsubscribed'))
    ->name('newsletter.unsubscribe');

// Test-only harness for the class/ascendancy portrait snapshot test. Never
// exposed in production.
if (app()->environment('local', 'testing')) {
    Route::inertia('__test/class-portraits', 'test/class-portraits')
        ->name('test.class-portraits');
}
