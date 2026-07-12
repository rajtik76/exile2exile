<?php

declare(strict_types=1);

use App\Models\SharedTree;
use App\Support\TreeHash;
use App\Tree\TreeIndex;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Legacy shares stored `ascendId` as GGG's internal id ("Monk1") because the
     * planner picker used it before the tree normaliser began keying ascendancies
     * by display name. Rewrite those to the name ("Martial Artist") - the form
     * every current path stores and the renderer expects - and re-hash so the
     * content-addressed dedup still points at the same row.
     */
    public function up(): void
    {
        // On a fresh migration chain the model's table (shared_trees) does not exist
        // yet - it is renamed from shared_builds in a later migration - and a fresh
        // database holds no legacy rows to rewrite anyway. Production already ran
        // this migration before the rename, against the old table name.
        if (! Schema::hasTable(new SharedTree()->getTable())) {
            return;
        }

        // ascendancies[className] is keyed by internal id -> display name.
        $classes = app(TreeIndex::class)->classes();

        SharedTree::query()->chunkById(200, function ($builds) use ($classes): void {
            foreach ($builds as $shared) {
                $build = $shared->build->toArray();
                $ascendId = $build['ascendId'] ?? null;

                if (! is_string($ascendId)) {
                    continue;
                }

                $name = $classes[$build['className']]['ascendancies'][$ascendId] ?? null;

                // Only internal ids resolve here; a name-form ascendId (or an
                // unknown one) isn't in the map, so it's already correct.
                if ($name === null || $name === $ascendId) {
                    continue;
                }

                $build['ascendId'] = $name;

                $shared->forceFill([
                    'build' => $build,
                    'hash' => TreeHash::canonical($build),
                ])->saveQuietly();
            }
        });
    }

    /**
     * One-way: the display name is the canonical form and nothing needs the old
     * internal id back. Re-running up() is safe - name-form rows are skipped.
     */
    public function down(): void
    {
        // Intentionally irreversible.
    }
};
