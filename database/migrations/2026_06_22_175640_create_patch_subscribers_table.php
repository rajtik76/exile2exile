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
        Schema::create('patch_subscribers', function (Blueprint $table) {
            $table->id();
            $table->string('url')->unique();
            $table->string('secret');
            $table->timestamp('verified_at')->nullable();
            $table->string('last_notified_version')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patch_subscribers');
    }
};
