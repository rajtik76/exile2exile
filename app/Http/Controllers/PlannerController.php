<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Filter\Neversink\NeversinkStrictness;
use App\Filter\Neversink\NeversinkStyle;
use App\Http\Requests\DestroyPlanRequest;
use App\Http\Requests\ImportPlanRequest;
use App\Http\Requests\StorePlanRequest;
use App\Http\Requests\UpdatePlanRequest;
use App\Models\BuildPlan;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\PlanReferences;
use App\Support\Planner\PlanSchema;
use App\Support\Planner\PobPlanMapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The build planner: a guest authors a build guide (a description, plus per-phase
 * items/gems/tree lists with priorities and notes) and saves it under a public
 * slug. Editing is gated by a secret token handed back at creation - same
 * account-less guest model as {@see SharedBuildController}. The stored JSON shape
 * and all its rules live in {@see PlanSchema}.
 */
class PlannerController extends Controller
{
    /**
     * Length of the generated public slug. 12 base62 chars ≈ 71 bits - unguessable
     * with vanishing collision odds.
     */
    private const int SLUG_LENGTH = 12;

    /**
     * Length of the secret edit token. Longer than the slug: it is the only thing
     * standing between a public link and a mutable guide.
     */
    private const int TOKEN_LENGTH = 64;

    /** Wrong unlock attempts (per plan + IP) before a cool-off kicks in. */
    private const int UNLOCK_MAX_ATTEMPTS = 3;

    /** How long the unlock cool-off lasts once the attempt cap is hit, in seconds. */
    private const int UNLOCK_LOCK_SECONDS = 900;

    /**
     * The empty editor for a brand-new plan, seeded with only the first phase ("Act I").
     */
    public function create(): Response
    {
        return Inertia::render('planner/edit', [
            'mode' => 'create',
            'slug' => null,
            'editToken' => null,
            'title' => '',
            'plan' => PlanSchema::blank(),
            'references' => (object) [],
            'mods' => (object) [],
        ]);
    }

    /**
     * Persist a new plan under a fresh slug, mint its secret edit token and send the
     * author to the editor with the token in hand. Shape and integrity live in
     * {@see StorePlanRequest} / {@see PlanSchema}.
     */
    public function store(StorePlanRequest $request): RedirectResponse
    {
        return $this->persist($request, $request->title(), $request->planData());
    }

    /**
     * Import a Path of Building export (or pobb.in link) into the editor, WITHOUT
     * persisting anything. The decoded build is mapped into the planner's shape by
     * {@see PobPlanMapper} - class, ascendancy, passive tree, gem groups and equipment -
     * and handed back as JSON for the create editor to seed its local state from. The
     * plan only reaches the database when the author saves it (the normal store action),
     * so an import is throwaway until then and never leaves a stray row behind.
     * Resolution and validity are enforced in {@see ImportPlanRequest}.
     */
    public function import(ImportPlanRequest $request, PobPlanMapper $mapper): JsonResponse
    {
        $snapshot = $request->snapshot();
        $plan = PlanSchema::canonicalize($mapper->map($snapshot));

        return response()->json([
            'title' => $mapper->title($snapshot),
            'plan' => $plan,
            // Author-mod lines the reverse-match could not resolve, keyed by slot, so the
            // editor can tell the author what the import left off (read after map()).
            'droppedMods' => $mapper->droppedMods(),
        ]);
    }

    /**
     * Persist a plan under a fresh slug, mint its secret edit token and send the author to
     * the editor holding it. The unlock is remembered in the session so the author lands
     * straight in the editor without the token ever touching the URL - they must save the
     * token (shown once in the editor) to unlock again from another browser.
     *
     * @param  array<string, mixed>  $data  already-canonical plan JSON
     */
    private function persist(Request $request, string $title, array $data): RedirectResponse
    {
        $token = Str::random(self::TOKEN_LENGTH);

        $plan = BuildPlan::create([
            'slug' => $this->freshSlug(),
            'edit_token' => $token,
            'title' => $title,
            'schema_version' => PlanSchema::CURRENT_VERSION,
            'data' => $data,
        ]);

        $request->session()->put($plan->unlockSessionKey(), $token);

        return to_route('planner.edit', ['plan' => $plan->slug]);
    }

    /**
     * The read-only guide, resolved by its public slug. An unknown slug 404s.
     */
    public function show(BuildPlan $plan, IconResolver $icons, ModCatalogue $catalogue): Response
    {
        // Record the visit so a future cleanup can prune guides nobody opens, without
        // touching `updated_at` or firing model events.
        $plan->forceFill(['last_viewed_at' => now()])->saveQuietly();

        $data = PlanSchema::normalize($plan->data, $plan->schema_version);

        return Inertia::render('planner/show', [
            'slug' => $plan->slug,
            'title' => $plan->title,
            'plan' => $data,
            'references' => (object) PlanReferences::resolveMap($data, $icons),
            'mods' => (object) PlanReferences::resolveModMap($data, $catalogue),
            // Loot-filter theme palettes and strictness levels for the download panel's
            // live preview + pickers.
            'filterThemes' => NeversinkStyle::all(),
            'filterStrictness' => NeversinkStrictness::all(),
            'meta' => [
                'title' => $plan->title,
                'description' => Str::limit(trim((string) $data['description']), 160),
            ],
        ]);
    }

    /**
     * The editor for an existing plan. Reachable only once the session has been unlocked
     * with the secret token (via {@see unlock()}); otherwise it shows the unlock form
     * instead of the editor, so the public slug alone can't reach it. A legacy `?token=`
     * link is honoured once - it unlocks the session and redirects to the clean URL, so
     * the token never lingers in the address bar, history or server logs.
     */
    public function edit(BuildPlan $plan, Request $request, IconResolver $icons, ModCatalogue $catalogue): Response|RedirectResponse
    {
        $token = $request->query('token');

        if (is_string($token) && $plan->matchesEditToken($token)) {
            $request->session()->put($plan->unlockSessionKey(), $token);

            return to_route('planner.edit', ['plan' => $plan->slug]);
        }

        if (! $plan->isUnlockedIn($request->session())) {
            return Inertia::render('planner/unlock', [
                'slug' => $plan->slug,
                'title' => $plan->title,
            ]);
        }

        $data = PlanSchema::normalize($plan->data, $plan->schema_version);

        return Inertia::render('planner/edit', [
            'mode' => 'edit',
            'slug' => $plan->slug,
            'editToken' => $plan->edit_token,
            'title' => $plan->title,
            'plan' => $data,
            'references' => (object) PlanReferences::resolveMap($data, $icons),
            'mods' => (object) PlanReferences::resolveModMap($data, $catalogue),
        ]);
    }

    /**
     * Verify the secret token submitted through the unlock form and, on success, remember
     * it in the session before sending the author into the editor. The token travels only
     * in this POST body - never a URL - and a wrong token bounces back with an error.
     */
    public function unlock(BuildPlan $plan, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        // Hard lock after a few wrong tries. The 64-char token is unbruteforceable, so
        // this is abuse/typo control rather than a real defence: three misses per plan+IP
        // buy a cool-off, and a correct unlock clears the counter.
        $throttleKey = "planner-unlock:{$plan->slug}|".$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::UNLOCK_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back()->withErrors([
                'token' => "Too many attempts. Try again in {$seconds} seconds.",
            ]);
        }

        if (! $plan->matchesEditToken($validated['token'])) {
            RateLimiter::hit($throttleKey, self::UNLOCK_LOCK_SECONDS);

            return back()->withErrors(['token' => 'That edit token is not valid for this build.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->put($plan->unlockSessionKey(), $validated['token']);

        return to_route('planner.edit', ['plan' => $plan->slug]);
    }

    /**
     * Save an edit. The token is verified in {@see UpdatePlanRequest::authorize()};
     * the blob is canonicalised and re-stamped to the current schema version.
     */
    public function update(BuildPlan $plan, UpdatePlanRequest $request): RedirectResponse
    {
        $plan->update([
            'title' => $request->title(),
            'schema_version' => PlanSchema::CURRENT_VERSION,
            'data' => $request->planData(),
        ]);

        // No token in the redirect URL: the session is already unlocked (UpdatePlanRequest
        // required it), so re-appending the secret would only leak it into logs and history.
        return to_route('planner.edit', ['plan' => $plan->slug]);
    }

    /**
     * Delete a plan for good. Double-gated: {@see DestroyPlanRequest::authorize()}
     * requires the unlocked session, and the token re-typed into the delete form must
     * match - timing-safe, rate-limited like {@see unlock()} so a lingering unlock
     * can't be abused to guess a rotated token. The token arrives only in the POST
     * body and is never echoed, logged or flashed; the redirect carries none of it.
     */
    public function destroy(BuildPlan $plan, DestroyPlanRequest $request): RedirectResponse
    {
        $throttleKey = "planner-destroy:{$plan->slug}|".$request->ip();

        // Errors land back on the editor even when the Referer is stripped.
        $fallback = route('planner.edit', ['plan' => $plan->slug]);

        if (RateLimiter::tooManyAttempts($throttleKey, self::UNLOCK_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back(fallback: $fallback)->withErrors([
                'token' => "Too many attempts. Try again in {$seconds} seconds.",
            ]);
        }

        if (! $plan->matchesEditToken($request->string('token')->toString())) {
            RateLimiter::hit($throttleKey, self::UNLOCK_LOCK_SECONDS);

            return back(fallback: $fallback)->withErrors(['token' => 'That edit token is not valid for this build.']);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->forget($plan->unlockSessionKey());
        $plan->delete();

        return to_route('planner.create');
    }

    /**
     * A random base62 slug no live row uses yet. Re-rolls rather than risk a
     * unique-constraint failure on insert.
     */
    private function freshSlug(): string
    {
        do {
            $slug = Str::random(self::SLUG_LENGTH);
        } while (BuildPlan::where('slug', $slug)->exists());

        return $slug;
    }
}
