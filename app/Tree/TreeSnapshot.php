<?php

declare(strict_types=1);

namespace App\Tree;

use App\Models\SharedTree;
use Illuminate\Contracts\Database\Eloquent\Castable;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use JsonSerializable;

/**
 * One passive tree as a whole: the class and ascendancy the allocation was made
 * for, plus the {@see TreeAllocation} itself. What {@see SharedTree} stores in
 * its `build` column (through the Eloquent cast below), what the PoB decode
 * endpoint returns and what the tree pages receive as their build prop.
 *
 * The wire and storage shape stays the flat legacy array (className/ascendId
 * beside the allocation keys), so existing rows, saved links and the frontend
 * types all keep working unchanged.
 */
final readonly class TreeSnapshot implements Castable, JsonSerializable
{
    public function __construct(
        public string $className,
        public ?string $ascendId,
        public TreeAllocation $allocation,
    ) {}

    /**
     * Rebuild from the flat stored form; the allocation keys are coerced by
     * {@see TreeAllocation::fromArray()}, so a legacy row missing a newer key
     * (weaponSets, jewels, treeVersion) hydrates cleanly.
     *
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            className: is_string($data['className'] ?? null) ? $data['className'] : '',
            ascendId: is_string($data['ascendId'] ?? null) && $data['ascendId'] !== '' ? $data['ascendId'] : null,
            allocation: TreeAllocation::fromArray($data),
        );
    }

    /**
     * The flat plain-array form persisted to the database.
     *
     * @return array{className: string, ascendId: ?string, allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int|string, mixed>, treeVersion: ?string}
     */
    public function toArray(): array
    {
        return [
            'className' => $this->className,
            'ascendId' => $this->ascendId,
            ...$this->allocation->toArray(),
        ];
    }

    /**
     * The same flat shape for JSON responses and Inertia props, with the
     * node-id-keyed maps forced to JSON objects even when empty ({} rather
     * than []), the form the renderer looks up by node id.
     *
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        $data = $this->toArray();
        $data['attributeChoices'] = (object) $data['attributeChoices'];
        $data['weaponSets'] = (object) $data['weaponSets'];
        $data['jewels'] = (object) $data['jewels'];

        return $data;
    }

    /**
     * The Eloquent cast behind {@see SharedTree::$build}: the column holds the
     * flat JSON and the model hands back this value object. set() also accepts
     * a plain array, so seeding a row from an array literal keeps working.
     *
     * @return CastsAttributes<self, self|array<int|string, mixed>>
     */
    public static function castUsing(array $arguments): CastsAttributes
    {
        return new class implements CastsAttributes
        {
            public function get(Model $model, string $key, mixed $value, array $attributes): ?TreeSnapshot
            {
                return is_string($value)
                    ? TreeSnapshot::fromArray((array) json_decode($value, true))
                    : null;
            }

            public function set(Model $model, string $key, mixed $value, array $attributes): ?string
            {
                if ($value === null) {
                    return null;
                }

                $snapshot = $value instanceof TreeSnapshot ? $value : TreeSnapshot::fromArray((array) $value);

                return (string) json_encode($snapshot->toArray());
            }
        };
    }
}
