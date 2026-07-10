<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Pob\Reference\BuildReference;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the passive-tree allocation a guest wants to share. Field shape lives
 * in {@see rules()}; the integrity check - every allocated node must exist in the
 * current tree - runs in {@see after()} so a forged or stale payload can't carve a
 * link to nodes that aren't real. The exposed {@see build()} is the sanitised
 * allocation the controller persists verbatim.
 *
 * No auth: sharing is a guest action, like the rest of the build tooling.
 */
class ShareBuildRequest extends FormRequest
{
    /**
     * Upper bound on allocated nodes. A full build spends ~123 points plus its
     * ascendancy and any pathing; this leaves generous head-room while capping
     * the payload so a junk request can't store an arbitrarily large blob.
     */
    private const int MAX_NODES = 600;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'className' => ['required', 'string', 'max:50'],
            'ascendId' => ['nullable', 'string', 'max:50'],
            'allocated' => ['required', 'array', 'max:'.self::MAX_NODES],
            'allocated.*' => ['integer'],
            'treeVersion' => ['nullable', 'string', 'max:20'],
            // Node id -> chosen attribute, for generic +attribute nodes.
            'attributeChoices' => ['nullable', 'array', 'max:'.self::MAX_NODES],
            'attributeChoices.*' => ['in:str,dex,int'],
            // Node id -> weapon set (1 or 2) for set-specific allocations.
            'weaponSets' => ['nullable', 'array', 'max:'.self::MAX_NODES],
            'weaponSets.*' => ['integer', 'in:1,2'],
            // Socketed tree jewels, keyed by socket node id. Display-only blob, count-capped
            // so a junk request can't persist an unbounded payload (shared rows are never
            // deleted and are re-embedded in every render).
            'jewels' => ['nullable', 'array', 'max:'.self::MAX_NODES],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(BuildReference $reference): array
    {
        return [
            function (Validator $validation) use ($reference): void {
                if ($validation->errors()->isNotEmpty()) {
                    return;
                }

                $nodes = $reference->passiveNodeIds();

                foreach ($this->integerArray('allocated') as $nodeId) {
                    if (! isset($nodes[$nodeId])) {
                        $validation->errors()->add('allocated', 'The build allocates a passive node that does not exist in the current tree.');

                        return;
                    }
                }
            },
        ];
    }

    /**
     * The sanitised allocation to persist: only the keys the viewer renders, with
     * the node ids cast to a clean integer list.
     *
     * @return array{className: string, ascendId: ?string, allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int|string, mixed>, treeVersion: ?string}
     */
    public function build(): array
    {
        return [
            'className' => (string) $this->input('className'),
            'ascendId' => $this->stringOrNull('ascendId'),
            'allocated' => $this->integerArray('allocated'),
            'attributeChoices' => $this->attributeChoices(),
            'weaponSets' => $this->weaponSets(),
            'jewels' => is_array($this->input('jewels')) ? $this->input('jewels') : [],
            'treeVersion' => $this->stringOrNull('treeVersion'),
        ];
    }

    /**
     * Node id -> weapon set (1 or 2), with the keys normalised to integers. Only
     * allocated nodes are kept, so a stray assignment to an unallocated node is
     * dropped rather than stored.
     *
     * @return array<int, int>
     */
    private function weaponSets(): array
    {
        $sets = $this->input('weaponSets');

        if (! is_array($sets)) {
            return [];
        }

        $allocated = array_flip($this->integerArray('allocated'));
        $normalised = [];

        foreach ($sets as $nodeId => $set) {
            if (isset($allocated[(int) $nodeId])) {
                $normalised[(int) $nodeId] = (int) $set;
            }
        }

        return $normalised;
    }

    /**
     * @return list<int>
     */
    private function integerArray(string $key): array
    {
        $value = $this->input($key);

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(intval(...), $value));
    }

    /**
     * Node id -> attribute choice, with the keys normalised to integers.
     *
     * @return array<int, string>
     */
    private function attributeChoices(): array
    {
        $choices = $this->input('attributeChoices');

        if (! is_array($choices)) {
            return [];
        }

        $normalised = [];

        foreach ($choices as $nodeId => $attribute) {
            $normalised[(int) $nodeId] = (string) $attribute;
        }

        return $normalised;
    }

    private function stringOrNull(string $key): ?string
    {
        $value = $this->input($key);

        return is_string($value) && $value !== '' ? $value : null;
    }
}
