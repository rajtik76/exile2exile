<?php

namespace App\Http\Controllers;

use App\Models\SharedTree;
use App\Pob\Source\BuildSourceRegistry;
use App\Pob\Validation\BuildValidator;
use App\Tree\TreeAllocation;
use App\Tree\TreeSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class TreeController extends Controller
{
    /**
     * The passive-tree planner. With `?from={slug}` it opens seeded with a shared
     * build's allocation, handed in as `initialBuild` so the editable planner can
     * adopt it as a snapshot - the tree only, no gems or items, since a shared
     * build carries no gear. An unknown slug is ignored and the planner opens empty.
     */
    public function index(Request $request): Response
    {
        $from = $request->query('from');

        $initialBuild = is_string($from)
            ? SharedTree::where('slug', $from)->value('build')
            : null;

        return Inertia::render('tree', [
            'mode' => 'create',
            'slug' => null,
            'editToken' => null,
            'initialBuild' => $initialBuild,
        ]);
    }

    /**
     * Decode a PoB export code (or pobb.in link) into the minimal allocation the
     * passive-tree renderer needs: the class, ascendancy and the set of allocated
     * node ids. Gems and items are irrelevant here and dropped.
     *
     * The input is resolved (raw code / pobb.in) and validated (the build must
     * decode and its passive nodes must exist in the current tree) before any
     * allocation is returned.
     *
     * @throws ValidationException when the code cannot be resolved or is invalid
     */
    public function allocation(Request $request, BuildSourceRegistry $sources, BuildValidator $validator): JsonResponse
    {
        $input = trim((string) $request->input('code', ''));

        if ($input === '') {
            throw ValidationException::withMessages(['code' => 'Paste a Path of Building 2 export code or pobb.in link.']);
        }

        try {
            $code = $sources->resolveCode($input);
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages([
                'code' => str_contains($e->getMessage(), 'pobb.in')
                    ? $e->getMessage()
                    : 'This is not a valid Path of Building 2 export code or pobb.in link.',
            ]);
        }

        $validity = $validator->validate($code);
        $build = $validity->snapshot;

        if (! $validity->valid || $build === null) {
            throw ValidationException::withMessages(['code' => implode(' ', $validity->errors)]);
        }

        // The build is identified by class *name*: PoB's numeric classId is
        // not stable across versions (an older Mercenary exports as classId
        // 3, which is Duelist in the live tree). The frontend resolves the
        // name to the live GGG class id against the loaded tree. The snapshot's
        // JSON form encodes the node-id-keyed maps as `{}` even when empty, the
        // form the renderer looks up by node id.
        return response()->json(new TreeSnapshot(
            className: $build->class->value,
            ascendId: $build->ascendancy?->value,
            allocation: new TreeAllocation(
                allocated: $build->passiveNodes,
                attributeChoices: $this->attributeChoices($build->attributeNodes),
                weaponSets: $build->weaponSets,
                jewels: $build->jewels,
                treeVersion: $build->treeVersion,
            ),
        ));
    }

    /**
     * Flatten the snapshot's per-attribute node lists into a node-id -> choice
     * map the renderer can look up directly.
     *
     * @param  array{str: list<int>, dex: list<int>, int: list<int>}  $attributeNodes
     * @return array<int, string>
     */
    private function attributeChoices(array $attributeNodes): array
    {
        $choices = [];

        foreach ($attributeNodes as $attribute => $nodeIds) {
            foreach ($nodeIds as $nodeId) {
                $choices[$nodeId] = $attribute;
            }
        }

        return $choices;
    }
}
