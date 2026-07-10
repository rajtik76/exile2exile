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
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            // The request path, no leading slash (e.g. "tree", "t/abc123"). Home is "/".
            $table->string('path')->index();
            // Where the visitor came from, when the browser sent a Referer. Null otherwise.
            $table->string('referrer')->nullable();
            // Per-day pseudonymous visitor key: hash(ip + ua + date + app key). The raw
            // IP is never stored, so this only counts unique visitors within one day.
            $table->string('visitor', 32)->index();
            // True for Inertia SPA navigations (X-Inertia header), false for cold loads.
            $table->boolean('inertia')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('page_views');
    }
};
