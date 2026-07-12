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
            // Secret edit token, minted at share time - the same guest ownership
            // model as build_plans. Nullable: rows shared before editing existed
            // carry no token and stay read-only forever (nobody can prove
            // authorship of them), while every new share is editable.
            $table->string('edit_token', 64)->nullable()->after('hash');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shared_builds', function (Blueprint $table) {
            $table->dropColumn('edit_token');
        });
    }
};
