<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            // Per-row secret used in confirm/unsubscribe links. Unlike signed
            // URLs it survives an APP_KEY rotation, so links in already
            // delivered mail keep working.
            $table->string('token', 64)->nullable()->unique();
            // Every read path filters on confirmed_at (stats, send fan-out).
            $table->index('confirmed_at');
        });

        // Backfill rows created before the column existed.
        DB::table('newsletter_subscribers')
            ->whereNull('token')
            ->orderBy('id')
            ->pluck('id')
            ->each(function (int $id): void {
                DB::table('newsletter_subscribers')
                    ->where('id', $id)
                    ->update(['token' => Str::random(48)]);
            });
    }

    public function down(): void
    {
        Schema::table('newsletter_subscribers', function (Blueprint $table) {
            $table->dropColumn('token');
            $table->dropIndex(['confirmed_at']);
        });
    }
};
