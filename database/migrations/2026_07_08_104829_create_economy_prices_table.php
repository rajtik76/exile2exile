<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Locally-cached poe2scout economy snapshot. One row per priced item per
     * league, refreshed in place by `poe2:sync-economy` (their data moves in
     * 6-hour blocks). The loot-filter generator reads only from here (never
     * poe2scout at request time), so an API outage can't break filter generation.
     */
    public function up(): void
    {
        Schema::create('economy_prices', function (Blueprint $table) {
            $table->id();
            // Canonical league name in poe2scout's API path, e.g. "Runes of Aldur"
            // (a build's economy context).
            $table->string('league');
            // 'currency' (any stackable: currency, runes, essences, omens, oils, …) or
            // 'unique'. Rare items are never priced - they carry no market index.
            $table->string('kind');
            // poe2scout sub-category, e.g. 'currency', 'fragments', 'essences', 'weapon'.
            $table->string('category');
            // poe2scout's stable id for the item (currency ApiId / unique id), for traceability.
            $table->string('api_id')->nullable();
            // Display name - the currency/unique name shown in game.
            $table->string('name');
            // The game base type the loot filter keys on via `BaseType`. Currency = its own
            // name; a unique = the base it drops on (many uniques can share one base).
            $table->string('base_type')->nullable();
            // Current price in Exalted Orbs (poe2scout's base currency for PoE2).
            $table->double('price');
            // Listing depth behind the price - a thin market is a low-confidence price.
            $table->unsignedInteger('quantity')->nullable();
            $table->timestamps();

            // One row per item per league; the sync upserts on this key.
            $table->unique(['league', 'kind', 'category', 'name']);
            // The filter generator reads a whole league (optionally a base type) at once.
            $table->index(['league', 'kind', 'base_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('economy_prices');
    }
};
