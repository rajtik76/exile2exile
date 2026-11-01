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
        Schema::dropIfExists('page_views');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            $table->string('path')->index();
            $table->string('referrer')->nullable();
            $table->string('visitor', 32)->index();
            $table->boolean('inertia')->default(false);
            $table->string('device', 16)->default('desktop')->index();
            $table->timestamps();
        });
    }
};
