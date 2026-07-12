<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\DestroySharedTreeRequest;
use App\Http\Requests\ShareTreeRequest;
use App\Http\Requests\UpdateSharedTreeRequest;
use App\Http\Resources\TreeSummaryResource;
use App\Models\SharedTree;
use App\Tree\TreeSummary;
use App\Tree\TreeSummaryBuilder;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Shared passive trees: a guest saves an allocation under a public slug (/t/{slug})
 * and edits it only with the secret token minted at save time - the same account-less
 * guest model as {@see PlannerController}. Rows shared before the edit flow carry no
 * token and stay read-only forever.
 */
class SharedTreeController extends Controller
{
    /**
     * Length of the generated public slug. 12 base62 chars ≈ 71 bits - long
     * enough that links are unguessable and collisions are vanishing.
     */
    private const int SLUG_LENGTH = 12;

    /**
     * Length of the secret edit token. Longer than the slug: it is the only thing
     * standing between a public link and a mutable tree.
     */
    private const int TOKEN_LENGTH = 64;

    /** Wrong unlock attempts (per build + IP) before a cool-off kicks in. */
    private const int UNLOCK_MAX_ATTEMPTS = 3;

    /** How long the unlock cool-off lasts once the attempt cap is hit, in seconds. */
    private const int UNLOCK_LOCK_SECONDS = 900;

    /**
     * Bumped whenever {@see TreeSummaryBuilder}'s output shape or resolution
     * logic changes, so the forever-cached summaries are re-resolved instead of
     * served from a stale entry. v2: ascendancy name-vs-id fix. v4: cache holds the
     * summary's plain array (a value object failed to unserialize from Redis).
     * v5: the key prefix moved from `ai.build.doc` to `tree.summary` (the
     * BuildDocument -> TreeSummary rename); v4 entries are orphaned, not read.
     */
    private const int SUMMARY_VERSION = 5;

    /**
     * Persist a guest's passive-tree allocation under a fresh public slug, mint its
     * secret edit token and land the author on the edit page holding it. The unlock
     * is remembered in the session, so the author arrives straight in the editor
     * without the token ever touching a URL - they must save the token (shown in the
     * editor's link panel) to unlock again from another browser.
     *
     * Every save is its own row: shares used to be content-addressed (identical
     * trees collapsed to one row), but an editable row is owned by whoever holds
     * its token, so two authors must never converge on the same link.
     */
    public function store(ShareTreeRequest $request): RedirectResponse
    {
        $token = Str::random(self::TOKEN_LENGTH);

        $shared = SharedTree::create([
            'slug' => $this->freshSlug(),
            'edit_token' => $token,
            'build' => $request->build(),
        ]);

        $request->session()->put($shared->unlockSessionKey(), $token);

        return to_route('shared.edit', ['sharedTree' => $shared->slug]);
    }

    /**
     * Render the read-only viewer for a shared build: the class/ascendancy name
     * plate over a full-screen, non-editable passive tree. The slug resolves the
     * row through route-model binding; an unknown slug 404s.
     */
    public function show(SharedTree $sharedTree, TreeSummaryBuilder $builder, Cache $cache): Response
    {
        // Record the visit so a future cleanup can prune links nobody opens.
        // forceFill + saveQuietly leaves `updated_at` untouched - viewing mutates
        // nothing else, and no model events need to fire on a view.
        $sharedTree->forceFill(['last_viewed_at' => now()])->saveQuietly();

        // Resolve once and cache; the JSON endpoint shares this exact entry, so a
        // build is built at most once however it is first opened, then served from
        // cache until the next edit invalidates it. A never-opened build is never
        // resolved. The plain array is cached (a value object doesn't survive Redis
        // unserialize) and rebuilt.
        $summary = TreeSummary::fromArray($cache->rememberForever(
            $this->summaryKey($sharedTree->slug),
            fn (): array => $builder->build($sharedTree->build)->toArray(),
        ));

        return Inertia::render('tree/shared', [
            'build' => $sharedTree->build,
            'slug' => $sharedTree->slug,
            // Head metadata (app.blade.php): a digest and the JSON link.
            'meta' => [
                'title' => $summary->title(),
                'description' => $summary->description(),
                'alternateJson' => route('shared.json', $sharedTree->slug),
            ],
            // The resolved summary the blade template renders as visible (sr-only)
            // body text, so a plain HTML→markdown fetch - which strips head meta,
            // links and scripts and runs no JS - still reads the build off the page.
            'summary' => [
                'class' => $summary->class,
                'ascendancy' => $summary->ascendancy,
                'pointsAllocated' => $summary->pointsAllocated,
                'attributes' => $summary->attributes,
                'notables' => array_column($summary->notables, 'name'),
                'keystones' => array_column($summary->keystones, 'name'),
            ],
        ]);
    }

    /**
     * The editor for an existing shared tree. Reachable only once the session has
     * been unlocked with the secret token (via {@see unlock()}); otherwise it shows
     * the unlock form instead of the editor, so the public slug alone can't reach it.
     * Legacy token-less rows have no editor at all and bounce to the viewer.
     */
    public function edit(SharedTree $sharedTree, Request $request): Response|RedirectResponse
    {
        if (! $sharedTree->isEditable()) {
            return to_route('shared.show', ['sharedTree' => $sharedTree->slug]);
        }

        if (! $sharedTree->isUnlockedIn($request->session())) {
            return Inertia::render('tree/unlock', [
                'slug' => $sharedTree->slug,
                'className' => $sharedTree->build->className,
            ]);
        }

        return Inertia::render('tree', [
            'mode' => 'edit',
            'slug' => $sharedTree->slug,
            'editToken' => $sharedTree->edit_token,
            'initialBuild' => $sharedTree->build,
        ]);
    }

    /**
     * Verify the secret token submitted through the unlock form and, on success,
     * remember it in the session before sending the author into the editor. The token
     * travels only in this POST body - never a URL - and a wrong token bounces back
     * with an error.
     */
    public function unlock(SharedTree $sharedTree, Request $request): RedirectResponse
    {
        abort_unless($sharedTree->isEditable(), 404);

        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        // Hard lock after a few wrong tries. The 64-char token is unbruteforceable, so
        // this is abuse/typo control rather than a real defence: three misses per
        // build+IP buy a cool-off, and a correct unlock clears the counter.
        $throttleKey = "tree-unlock:{$sharedTree->slug}|".$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::UNLOCK_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back()->withErrors([
                'token' => "Too many attempts. Try again in {$seconds} seconds.",
            ]);
        }

        if (! $sharedTree->matchesEditToken($validated['token'])) {
            RateLimiter::hit($throttleKey, self::UNLOCK_LOCK_SECONDS);

            return back()->withErrors(['token' => 'That edit token is not valid for this build.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->put($sharedTree->unlockSessionKey(), $validated['token']);

        return to_route('shared.edit', ['sharedTree' => $sharedTree->slug]);
    }

    /**
     * Save an edit. The token is verified in {@see UpdateSharedTreeRequest::authorize()}
     * (the session must be unlocked); the allocation shape and node integrity are the
     * same checks a fresh share passes. The forever-cached resolved document is dropped
     * so the viewer and JSON endpoint re-resolve the edited tree.
     */
    public function update(SharedTree $sharedTree, UpdateSharedTreeRequest $request, Cache $cache): RedirectResponse
    {
        $sharedTree->update(['build' => $request->build()]);

        $cache->forget($this->summaryKey($sharedTree->slug));

        // No token in the redirect URL: the session is already unlocked
        // (UpdateSharedTreeRequest required it).
        return to_route('shared.edit', ['sharedTree' => $sharedTree->slug]);
    }

    /**
     * Delete a shared tree for good. Double-gated: {@see DestroySharedTreeRequest::authorize()}
     * requires the unlocked session, and the token re-typed into the delete form must
     * match - timing-safe, rate-limited like {@see unlock()} so a lingering unlock
     * can't be abused to guess a rotated token. The token arrives only in the request
     * body and is never echoed, logged or flashed; the redirect carries none of it.
     */
    public function destroy(SharedTree $sharedTree, DestroySharedTreeRequest $request, Cache $cache): RedirectResponse
    {
        $throttleKey = "tree-destroy:{$sharedTree->slug}|".$request->ip();

        // Errors land back on the editor even when the Referer is stripped.
        $fallback = route('shared.edit', ['sharedTree' => $sharedTree->slug]);

        if (RateLimiter::tooManyAttempts($throttleKey, self::UNLOCK_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back(fallback: $fallback)->withErrors([
                'token' => "Too many attempts. Try again in {$seconds} seconds.",
            ]);
        }

        if (! $sharedTree->matchesEditToken($request->string('token')->toString())) {
            RateLimiter::hit($throttleKey, self::UNLOCK_LOCK_SECONDS);

            return back(fallback: $fallback)->withErrors(['token' => 'That edit token is not valid for this build.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->forget($sharedTree->unlockSessionKey());
        $cache->forget($this->summaryKey($sharedTree->slug));
        $sharedTree->delete();

        return to_route('tree');
    }

    /**
     * The machine-readable tree summary, resolved through {@see TreeSummaryBuilder}
     * and cached until the next edit invalidates it. Shares its cache entry with
     * the page view, so on a hit neither the builder runs nor the DB is read.
     */
    public function showJson(string $slug, TreeSummaryBuilder $builder, Cache $cache): JsonResponse
    {
        $data = $cache->get($this->summaryKey($slug));

        if ($data === null) {
            $build = SharedTree::where('slug', $slug)->value('build');

            abort_if($build === null, 404);

            $data = $builder->build($build)->toArray();

            $cache->forever($this->summaryKey($slug), $data);
        }

        return response()->json(new TreeSummaryResource(TreeSummary::fromArray($data))->resolve());
    }

    /**
     * Cache key for a tree's resolved summary. Carries the data version (a new
     * league re-resolves node names) and {@see self::SUMMARY_VERSION} (bumped when
     * the builder's output changes), so a stale entry is abandoned, never served.
     */
    private function summaryKey(string $slug): string
    {
        return 'tree.summary:v'.self::SUMMARY_VERSION.':'.config()->string('poe.data_version').":{$slug}";
    }

    /**
     * A random base62 slug that no live row uses yet. Collisions are astronomically
     * unlikely at this length, but we re-roll rather than risk a unique-constraint
     * failure on insert.
     */
    private function freshSlug(): string
    {
        do {
            $slug = Str::random(self::SLUG_LENGTH);
        } while (SharedTree::where('slug', $slug)->exists());

        return $slug;
    }
}
