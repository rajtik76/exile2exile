<?php

declare(strict_types=1);

namespace App\Tree;

use Illuminate\Support\Str;

/**
 * A shared passive tree resolved into an AI- and human-readable summary: the
 * class, ascendancy and the allocated passives already named and classified, so
 * a reader never has to map node ids or apply per-class overrides itself.
 *
 * The single source both the on-page summary/head and the `/t/{slug}.json`
 * endpoint render from, so the two can never drift.
 */
final readonly class TreeSummary
{
    /**
     * @param  array{str: int, dex: int, int: int, unspecified: int}  $attributes
     * @param  list<array{id: int, name: string}>  $notables
     * @param  list<array{id: int, name: string}>  $keystones
     */
    public function __construct(
        public string $class,
        public ?string $ascendancy,
        public ?string $treeVersion,
        public int $pointsAllocated,
        public array $attributes,
        public array $notables,
        public array $keystones,
    ) {}

    /**
     * The plain-array form for caching. A value object doesn't round-trip through
     * a serializing cache (Redis) reliably - an unserialize can hand back an
     * incomplete class - so callers cache this and rebuild via {@see self::fromArray()}.
     *
     * @return array{class: string, ascendancy: ?string, treeVersion: ?string, pointsAllocated: int, attributes: array{str: int, dex: int, int: int, unspecified: int}, notables: list<array{id: int, name: string}>, keystones: list<array{id: int, name: string}>}
     */
    public function toArray(): array
    {
        return [
            'class' => $this->class,
            'ascendancy' => $this->ascendancy,
            'treeVersion' => $this->treeVersion,
            'pointsAllocated' => $this->pointsAllocated,
            'attributes' => $this->attributes,
            'notables' => $this->notables,
            'keystones' => $this->keystones,
        ];
    }

    /**
     * Rebuild from the {@see self::toArray()} form read back out of the cache.
     *
     * @param  array{class: string, ascendancy: ?string, treeVersion: ?string, pointsAllocated: int, attributes: array{str: int, dex: int, int: int, unspecified: int}, notables: list<array{id: int, name: string}>, keystones: list<array{id: int, name: string}>}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            class: $data['class'],
            ascendancy: $data['ascendancy'],
            treeVersion: $data['treeVersion'],
            pointsAllocated: $data['pointsAllocated'],
            attributes: $data['attributes'],
            notables: $data['notables'],
            keystones: $data['keystones'],
        );
    }

    /**
     * A concise page title: the class (or ascendancy) and the notable count.
     */
    public function title(): string
    {
        $who = $this->ascendancy !== null
            ? "{$this->ascendancy} ({$this->class})"
            : $this->class;

        return sprintf('%s · %s · PoE2 build', $who, $this->notableCountLabel());
    }

    /**
     * A one-line digest for `<meta name="description">`: who the build is and its
     * notables, so a text-only fetch reads the build without touching the JSON.
     */
    public function description(): string
    {
        $who = $this->ascendancy !== null
            ? "{$this->ascendancy} ({$this->class})"
            : $this->class;

        $summary = sprintf(
            '%s PoE2 passive tree - %d points, %s',
            $who,
            $this->pointsAllocated,
            $this->notableCountLabel(),
        );

        if ($this->notables !== []) {
            $names = implode(', ', array_column($this->notables, 'name'));
            $summary .= ": {$names}";
        }

        return Str::of($summary.'.')->trim()->toString();
    }

    private function notableCountLabel(): string
    {
        $count = count($this->notables);

        return $count === 1 ? '1 notable' : "{$count} notables";
    }
}
