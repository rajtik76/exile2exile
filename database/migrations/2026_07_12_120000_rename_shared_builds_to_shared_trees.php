<?php

declare(strict_types=1);

use App\Models\SharedTree;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A "shared build" was always just a saved passive tree, so the table follows
     * the model's rename to {@see SharedTree}. A pure metadata rename:
     * PostgreSQL keeps indexes, constraints and the id sequence attached (their
     * names keep the old prefix, which is harmless), and no data is rewritten.
     */
    public function up(): void
    {
        Schema::rename('shared_builds', 'shared_trees');
    }

    public function down(): void
    {
        Schema::rename('shared_trees', 'shared_builds');
    }
};
