<?php

declare(strict_types=1);

namespace App\Build;

/**
 * Read access to the current league's passive tree, resolved to the pieces a
 * build summary needs: each node's display name and kind, and each class's
 * per-node overrides and ascendancy names. Backed by the same GGPK-derived
 * {@see public/tree/current/data.json} the renderer draws from.
 */
interface TreeIndex
{
    /**
     * Every passive node keyed by id, as `{name, kind}`. `kind` is one of
     * `keystone`, `notable`, `mastery`, `jewel`, `attribute` or `small`.
     *
     * @return array<int, array{name: string, kind: string}>
     */
    public function nodes(): array;

    /**
     * Every class keyed by its display name (e.g. `Witch`), carrying the
     * per-node overrides (base node id -> the node whose name/stats a class
     * shows in its place) and its ascendancy names keyed by ascendancy id.
     *
     * @return array<string, array{overrides: array<int, int>, ascendancies: array<string, string>}>
     */
    public function classes(): array;
}
