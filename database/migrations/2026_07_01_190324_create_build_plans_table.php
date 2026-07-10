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
        Schema::create('build_plans', function (Blueprint $table) {
            $table->id();
            // Public, unguessable read slug (route-model bound). Editing needs the
            // secret token below - same guest model as shared builds, no accounts.
            $table->string('slug')->unique();
            $table->char('edit_token', 64)->unique();
            $table->string('title');
            // Version of the JSON shape stored in `data`, so a future schema change
            // knows which upgrade steps a stale row still needs (see PlanSchema).
            $table->unsignedSmallInteger('schema_version');
            $table->json('data');
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('build_plans');
    }
};
