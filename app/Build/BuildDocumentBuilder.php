<?php

declare(strict_types=1);

namespace App\Build;

/**
 * Turns a stored share allocation into a {@see BuildDocument}: resolves node ids
 * to names (applying the build's class overrides exactly as the renderer does),
 * classifies notables and keystones, and breaks the attribute nodes down by
 * STR/DEX/INT. Unknown node ids (a build shared against a since-changed tree)
 * are skipped rather than guessed at.
 */
final readonly class BuildDocumentBuilder
{
    public function __construct(private TreeIndex $tree) {}

    /**
     * @param  array{className?: string, ascendId?: ?string, allocated?: list<int>, attributeChoices?: array<int|string, string>, treeVersion?: ?string}  $build
     */
    public function build(array $build): BuildDocument
    {
        $className = (string) ($build['className'] ?? '');
        $allocated = array_map(intval(...), $build['allocated'] ?? []);
        $attributeChoices = $build['attributeChoices'] ?? [];

        $nodes = $this->tree->nodes();
        $class = $this->tree->classes()[$className] ?? null;
        $overrides = $class['overrides'] ?? [];

        $notables = [];
        $keystones = [];
        $attributeNodeIds = [];

        foreach ($allocated as $id) {
            $node = $nodes[$id] ?? null;

            if ($node === null) {
                continue;
            }

            $name = $this->resolveName($id, $node['name'], $overrides, $nodes);

            match ($node['kind']) {
                'notable' => $notables[] = ['id' => $id, 'name' => $name],
                'keystone' => $keystones[] = ['id' => $id, 'name' => $name],
                'attribute' => $attributeNodeIds[] = $id,
                default => null,
            };
        }

        return new BuildDocument(
            class: $className,
            ascendancy: $this->resolveAscendancy($class, $build['ascendId'] ?? null),
            treeVersion: $build['treeVersion'] ?? null,
            pointsAllocated: count($allocated),
            attributes: $this->attributeBreakdown($attributeNodeIds, $attributeChoices),
            notables: $notables,
            keystones: $keystones,
        );
    }

    /**
     * The label a class actually shows at a node: the override target's name when
     * the class remaps it, otherwise the base node's own name.
     *
     * @param  array<int, int>  $overrides
     * @param  array<int, array{name: string, kind: string}>  $nodes
     */
    private function resolveName(int $id, string $baseName, array $overrides, array $nodes): string
    {
        $target = $overrides[$id] ?? null;

        if ($target === null) {
            return $baseName;
        }

        return $nodes[$target]['name'] ?? $baseName;
    }

    /**
     * The ascendancy's display name. A share stores whatever the importer had -
     * usually the name itself (the PoB enum value, e.g. "Blood Mage"), but an id
     * like "Witch2" for tree-native shares - so we map an id to its name and pass
     * an already-named value straight through, exactly as the viewer does.
     *
     * @param  array{overrides: array<int, int>, ascendancies: array<string, string>}|null  $class
     */
    private function resolveAscendancy(?array $class, ?string $ascendId): ?string
    {
        if ($class === null || $ascendId === null) {
            return null;
        }

        return $class['ascendancies'][$ascendId] ?? $ascendId;
    }

    /**
     * Break the allocated generic-attribute nodes down by the player's STR/DEX/INT
     * choice. Nodes whose choice was never recorded count as `unspecified`.
     *
     * @param  list<int>  $attributeNodeIds
     * @param  array<int|string, string>  $attributeChoices
     * @return array{str: int, dex: int, int: int, unspecified: int}
     */
    private function attributeBreakdown(array $attributeNodeIds, array $attributeChoices): array
    {
        $breakdown = ['str' => 0, 'dex' => 0, 'int' => 0, 'unspecified' => 0];

        foreach ($attributeNodeIds as $id) {
            $choice = $attributeChoices[$id] ?? null;

            if (is_string($choice) && isset($breakdown[$choice])) {
                $breakdown[$choice]++;
            } else {
                $breakdown['unspecified']++;
            }
        }

        return $breakdown;
    }
}
