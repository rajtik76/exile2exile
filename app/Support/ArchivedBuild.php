<?php

declare(strict_types=1);

namespace App\Support;

use App\Services\TreeSnapshots;
use App\Tree\TreeSnapshot;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * The stand-in page for a saved tree or plan that is not of the live game era. Its
 * nodes, items and gems belong to another era's data, so it is never drawn over the
 * live tree. A tree with a snapshot of its own era is drawn read-only on that tree.
 *
 * A build whose patch the era map no longer covers is a configuration fault, not an
 * old build: it renders an error page asking the visitor to get in touch, and is
 * logged so the operator hears about it.
 */
final readonly class ArchivedBuild
{
    public function __construct(private GameEra $eras, private TreeSnapshots $trees) {}

    public function tree(string $slug, TreeSnapshot $build, string $gamePatch): Response
    {
        $title = "{$build->className} passive tree";
        $era = $this->eras->forPatch($gamePatch);
        $treePatch = $era === null ? null : $this->trees->forPatch($gamePatch);

        if ($era === null || $treePatch === null) {
            return $this->render('tree', $slug, $title, $build->className, $gamePatch);
        }

        return Inertia::render('tree/shared', [
            'build' => $build,
            'slug' => $slug,
            'archive' => [
                'gameEra' => $era,
                'eraName' => $this->eras->nameOf($era),
                'gamePatch' => $gamePatch,
                'treePatch' => $treePatch,
                'treeVersion' => $this->trees->version($treePatch),
            ],
            'meta' => [
                'title' => "{$title} (PoE2 {$era})",
                'description' => "Made on Path of Exile 2 version {$era}.",
            ],
        ])->toResponse(request());
    }

    /**
     * @param  'tree'|'plan'  $kind
     */
    public function render(string $kind, string $slug, string $title, ?string $className, string $gamePatch, ?string $description = null): Response
    {
        $era = $this->eras->forPatch($gamePatch);

        if ($era === null) {
            Log::error("Saved {$kind} {$slug} is stamped with patch {$gamePatch}, which belongs to no game era in poe.eras.");
        }

        $version = $era === null ? "patch {$gamePatch}" : "version {$era}";

        return Inertia::render('archived-build', [
            'kind' => $kind,
            'title' => $title,
            'className' => $className,
            'gameEra' => $era,
            'eraName' => $this->eras->nameOf($era),
            'gamePatch' => $gamePatch,
            'meta' => [
                'title' => $era === null ? $title : "{$title} (PoE2 {$era})",
                'description' => $description ?? "Made on Path of Exile 2 {$version}.",
            ],
        ])->toResponse(request())->setStatusCode($era === null ? 500 : 200);
    }
}
