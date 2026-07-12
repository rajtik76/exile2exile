<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('newsletters', function (Blueprint $table) {
            // Fan-out cursor: highest subscriber id this issue has already been
            // queued for. A retried delivery job resumes after it instead of
            // re-mailing everyone from the start.
            $table->unsignedBigInteger('dispatched_up_to_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('newsletters', function (Blueprint $table) {
            $table->dropColumn('dispatched_up_to_id');
        });
    }
};
