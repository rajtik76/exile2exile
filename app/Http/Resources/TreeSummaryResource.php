<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Tree\TreeSummary;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The machine-readable shape of a shared tree served at `/t/{slug}.json`. A flat,
 * versioned document (no `data` envelope) so an AI reading the page gets the build
 * on a plate: class, ascendancy and the passives already named and classified.
 *
 * `passives` mirrors the planned per-section shape, so items, gems and multiple
 * build sections slot in around it later without reshaping what exists.
 *
 * @property TreeSummary $resource
 */
final class TreeSummaryResource extends JsonResource
{
    /**
     * Served as a canonical document, not a collection item - no `data` wrapper.
     */
    public static $wrap = null;

    /**
     * @return array<string, mixed>
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        $document = $this->resource;

        return [
            'schemaVersion' => 1,
            'game' => 'poe2',
            'treeVersion' => $document->treeVersion,
            'class' => $document->class,
            'ascendancy' => $document->ascendancy,
            'passives' => [
                'pointsAllocated' => $document->pointsAllocated,
                'attributes' => $document->attributes,
                'notables' => $document->notables,
                'keystones' => $document->keystones,
            ],
        ];
    }
}
