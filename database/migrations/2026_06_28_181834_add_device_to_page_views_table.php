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
        Schema::table('page_views', function (Blueprint $table) {
            // Coarse device class derived from the User-Agent: mobile, tablet or
            // desktop. The full UA is never stored, only this bucket. Defaults to
            // desktop so rows predating this column read sensibly.
            $table->string('device', 16)->default('desktop')->after('inertia')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('page_views', function (Blueprint $table) {
            $table->dropIndex(['device']);
            $table->dropColumn('device');
        });
    }
};
