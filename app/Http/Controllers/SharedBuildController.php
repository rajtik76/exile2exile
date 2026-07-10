<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Build\BuildDocument;
use App\Build\BuildDocumentBuilder;
use App\Http\Requests\ShareBuildRequest;
use App\Http\Resources\BuildDocumentResource;
use App\Models\SharedBuild;
use App\Support\BuildHash;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class SharedBuildController extends Controller
{
    /**
     * Length of the generated public slug. 12 base62 chars ≈ 71 bits - long
     * enough that links are unguessable and collisions are vanishing.
     */
    private const int SLUG_LENGTH = 12;

    /**
     * Bumped whenever {@see BuildDocumentBuilder}'s output shape or resolution
     * logic changes, so the forever-cached documents are re-resolved instead of
     * served from a stale entry. v2: ascendancy name-vs-id fix. v4: cache holds the
     * document's plain array (a value object failed to unserialize from Redis).
     */
    private const int DOCUMENT_VERSION = 4;

    /**
     * Persist a guest's passive-tree allocation under a fresh public slug and
     * hand back the shareable link. Each share is its own immutable row: there is
     * no owner, no dedup and no edit - to change a build, re-share it (see the
     * phase-1 guest model). Validation and sanitising live in {@see ShareBuildRequest}.
     */
    public function store(ShareBuildRequest $request): JsonResponse
    {
        $build = $request->build();

        // Content-addressed: an identical tree collapses to the row it already
        // owns, so re-sharing returns the same link instead of a duplicate.
        // createOrFirst is race-safe: two identical concurrent shares can't both insert -
        // the loser's unique-hash violation is caught and the existing row returned.
        $shared = SharedBuild::createOrFirst(
            ['hash' => BuildHash::canonical($build)],
            ['slug' => $this->freshSlug(), 'build' => $build],
        );

        return response()->json([
            'slug' => $shared->slug,
            'url' => route('shared.show', $shared),
        ]);
    }

    /**
     * Render the read-only viewer for a shared build: the class/ascendancy name
     * plate over a full-screen, non-editable passive tree. The slug resolves the
     * row through route-model binding; an unknown slug 404s.
     */
    public function show(SharedBuild $sharedBuild, BuildDocumentBuilder $builder, Cache $cache): Response
    {
        // Record the visit so a future cleanup can prune links nobody opens.
        // forceFill + saveQuietly leaves `updated_at` untouched - the row is
        // otherwise immutable, and no model events need to fire on a view.
        $sharedBuild->forceFill(['last_viewed_at' => now()])->saveQuietly();

        // Resolve once and cache; the JSON endpoint shares this exact entry, so a
        // build is built at most once however it is first opened, then served from
        // cache forever. A never-opened build is never resolved. The plain array is
        // cached (a value object doesn't survive Redis unserialize) and rebuilt.
        $document = BuildDocument::fromArray($cache->rememberForever(
            $this->documentKey($sharedBuild->slug),
            fn (): array => $builder->build($sharedBuild->build)->toArray(),
        ));

        return Inertia::render('tree/shared', [
            'build' => $sharedBuild->build,
            // Lets the viewer link back into the editable planner (/tree?from=slug).
            'slug' => $sharedBuild->slug,
            // Head metadata (app.blade.php): a digest and the JSON link.
            'meta' => [
                'title' => $document->title(),
                'description' => $document->description(),
                'alternateJson' => route('shared.json', $sharedBuild->slug),
            ],
            // The resolved summary the blade template renders as visible (sr-only)
            // body text, so a plain HTML→markdown fetch - which strips head meta,
            // links and scripts and runs no JS - still reads the build off the page.
            'summary' => [
                'class' => $document->class,
                'ascendancy' => $document->ascendancy,
                'pointsAllocated' => $document->pointsAllocated,
                'attributes' => $document->attributes,
                'notables' => array_column($document->notables, 'name'),
                'keystones' => array_column($document->keystones, 'name'),
            ],
        ]);
    }

    /**
     * The machine-readable build document, resolved through {@see BuildDocumentBuilder}
     * and cached forever (a shared build is immutable). Shares its cache entry with
     * the page view, so on a hit neither the builder runs nor the DB is read.
     */
    public function showJson(string $slug, BuildDocumentBuilder $builder, Cache $cache): JsonResponse
    {
        $data = $cache->get($this->documentKey($slug));

        if ($data === null) {
            $build = SharedBuild::where('slug', $slug)->value('build');

            abort_if($build === null, 404);

            $data = $builder->build($build)->toArray();

            $cache->forever($this->documentKey($slug), $data);
        }

        return response()->json(new BuildDocumentResource(BuildDocument::fromArray($data))->resolve());
    }

    /**
     * Cache key for a build's resolved document. Carries the data version (a new
     * league re-resolves node names) and {@see self::DOCUMENT_VERSION} (bumped when
     * the builder's output changes), so a stale entry is abandoned, never served.
     */
    private function documentKey(string $slug): string
    {
        return 'ai.build.doc:v'.self::DOCUMENT_VERSION.':'.config()->string('poe.data_version').":{$slug}";
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
        } while (SharedBuild::where('slug', $slug)->exists());

        return $slug;
    }
}
