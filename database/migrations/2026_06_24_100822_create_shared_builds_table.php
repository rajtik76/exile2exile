<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('shared_builds', function (Blueprint $table) {
            $table->id();
            // Public share id carried in the URL (/t/{slug}); random, unguessable.
            $table->string('slug')->unique();
            // The passive-tree allocation the viewer renders: class name,
            // ascendancy id, allocated node ids, attribute choices, jewels and the
            // tree version. Source-agnostic - a hand-edited tree shares the same as
            // an imported one, since we snapshot the canvas state, not a PoB code.
            $table->json('build');
            // Bumped on every view, so a future cleanup can prune links nobody
            // opens without touching the permanent-by-default contract today.
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shared_builds');
    }
};
