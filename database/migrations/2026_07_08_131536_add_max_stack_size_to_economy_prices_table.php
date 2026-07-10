<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The most units this item stacks to (from poe2scout metadata). Lets the filter
     * highlight a currency by StackSize when a full stack is worth more than a single
     * unit - a stack of ten Exalted can be surfaced even when one Exalted is not.
     */
    public function up(): void
    {
        Schema::table('economy_prices', function (Blueprint $table) {
            $table->unsignedInteger('max_stack_size')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('economy_prices', function (Blueprint $table) {
            $table->dropColumn('max_stack_size');
        });
    }
};
