<?php

use App\Support\GameEra;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Rows saved so far carry no patch of their own. They have always been drawn
        // over the live data, so the live patch is what they are stamped with.
        $livePatch = app(GameEra::class)->livePatchOrFail();

        foreach (['shared_trees', 'build_plans'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                // The raw GGG patch of the live data the build was last saved on. Its
                // game era is derived from it through poe.eras, never stored, so a
                // corrected era map re-files every build without touching the rows.
                $blueprint->string('game_patch', 32)->nullable()->after('slug');
            });

            DB::table($table)->update(['game_patch' => $livePatch]);

            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->string('game_patch', 32)->nullable(false)->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (['shared_trees', 'build_plans'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('game_patch');
            });
        }
    }
};
