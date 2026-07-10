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
        Schema::table('shared_builds', function (Blueprint $table) {
            // sha256 of the canonical allocation. Lets an identical build collapse
            // to one row, so re-sharing the same tree returns the same link instead
            // of minting duplicates. Nullable only to cover any pre-dedup rows.
            $table->string('hash', 64)->nullable()->unique()->after('slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shared_builds', function (Blueprint $table) {
            $table->dropColumn('hash');
        });
    }
};
