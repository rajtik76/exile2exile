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
        Schema::table('patch_subscribers', function (Blueprint $table) {
            // Consecutive failed webhook deliveries; reset to 0 on any success.
            // A verified subscriber is dropped once this reaches the limit.
            $table->unsignedSmallInteger('consecutive_failures')->default(0)->after('last_notified_version');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patch_subscribers', function (Blueprint $table) {
            $table->dropColumn('consecutive_failures');
        });
    }
};
