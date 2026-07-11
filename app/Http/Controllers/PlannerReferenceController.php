<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catalogue endpoints for the build-planner inline references. Both serve live GGPK
 * data (via {@see IconResolver}); nothing is cached client-side, so a chip's icon /
 * tooltip / flavour is always resolved fresh from the current data - the editor only
 * ever stores the `{{type:id}}` token itself.
 */
class PlannerReferenceController extends Controller
{
    /**
     * Search gems, runes and unique items by name for the reference picker.
     */
    public function search(Request $request, IconResolver $icons): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:60'],
            'type' => ['nullable', 'string', 'in:gem,rune,unique,base,item,notable'],
            'categories' => ['nullable', 'string', 'max:200'],
            'gemKind' => ['nullable', 'string', 'in:skill,support'],
        ]);

        // "item" is the equipment-slot filter: both craftable bases and uniques of the
        // slot categories (the editor derives the rarity from the pick + its mods, so it
        // no longer searches a single rarity). Otherwise a single type, or the default trio.
        $types = match ($validated['type'] ?? null) {
            null => ['gem', 'rune', 'unique', 'notable'],
            'item' => ['base', 'unique'],
            default => [$validated['type']],
        };

        $categories = isset($validated['categories'])
            ? array_values(array_filter(array_map(trim(...), explode(',', $validated['categories']))))
            : [];

        return response()->json([
            'results' => $icons->searchReferences(
                $validated['q'],
                $types,
                $categories,
                $validated['gemKind'] ?? null,
            ),
        ]);
    }

    /**
     * Search the GGPK affixes that can roll on a slot for the item modifier picker,
     * grouped into tier ladders. Filtering is by the chosen base's tags; before a base
     * is picked it falls back to the union of the slot categories' tags, so the author
     * still sees a sensible (looser) list.
     */
    public function mods(Request $request, IconResolver $icons, ModCatalogue $catalogue): JsonResponse
    {
        $validated = $request->validate([
            'base' => ['nullable', 'string', 'max:120'],
            'categories' => ['nullable', 'string', 'max:200'],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $hasBase = isset($validated['base']) && $validated['base'] !== '';
        $categories = $this->categoryList($validated['categories'] ?? null);

        // The mod catalogue is joined domain-first, then by tags - a base only sees mods of
        // its own domain (gear "Item", flasks/charms "Flask"). Before a base is picked, the
        // slot's categories stand in for both.
        $modDomain = $hasBase
            ? $icons->itemModDomain($validated['base'])
            : $icons->categoryDomain($categories);
        $baseTags = $hasBase
            ? $icons->itemTags($validated['base'])
            : $icons->categoryTags($categories);
        // The base's item class gates essence-only mods (an essence targets classes,
        // not tags); before a base is picked the gate stays lenient.
        $itemClass = $hasBase ? $icons->itemClass($validated['base']) : null;

        return response()->json([
            'results' => $catalogue->search($modDomain, $baseTags, $validated['q'] ?? '', itemClass: $itemClass),
        ]);
    }

    /**
     * Resolve a batch of mod ids to their live display data (tier line, ranges,
     * generation type), keyed by mod id. The editor calls this on load to render the
     * mods stored on a plan - only the `Mods.Id` and rolled values are persisted.
     */
    public function resolveMods(Request $request, ModCatalogue $catalogue): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['array', 'max:400'],
            'ids.*' => ['required', 'string', 'max:120'],
        ]);

        $map = [];

        foreach ($validated['ids'] ?? [] as $id) {
            $mod = $catalogue->resolve($id);

            if ($mod !== null) {
                $map[$id] = $mod;
            }
        }

        return response()->json(['mods' => (object) $map]);
    }

    /**
     * Parse the comma-separated `categories` query parameter into a clean list.
     *
     * @return list<string>
     */
    private function categoryList(?string $categories): array
    {
        if ($categories === null) {
            return [];
        }

        return array_values(array_filter(array_map(trim(...), explode(',', $categories))));
    }

    /**
     * Resolve a batch of reference tokens (type + id) to their live display data,
     * keyed by "type:id". The editor calls this on load for tokens in its text that
     * aren't already resolved, so references never go stale in a saved draft.
     */
    public function resolve(Request $request, IconResolver $icons): JsonResponse
    {
        $validated = $request->validate([
            'refs' => ['array', 'max:400'],
            'refs.*.type' => ['required', 'string', 'in:gem,rune,unique,base,notable'],
            'refs.*.id' => ['required', 'string', 'max:120'],
        ]);

        $map = [];

        foreach ($validated['refs'] ?? [] as $ref) {
            $resolved = $icons->resolveReference($ref['type'], $ref['id']);

            if ($resolved !== null) {
                $map[$ref['type'].':'.$ref['id']] = $resolved;
            }
        }

        return response()->json(['references' => (object) $map]);
    }
}
