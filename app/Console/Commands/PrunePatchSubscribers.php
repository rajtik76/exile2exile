<?php

namespace App\Console\Commands;

use App\Models\PatchSubscriber;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Deletes subscribers that never proved they own their endpoint, after a grace
 * window to fix the verification ping. Verified subscribers are pruned elsewhere,
 * by repeated delivery failure.
 */
#[Signature('poe2:prune-patch-subscribers')]
#[Description('Remove patch webhook subscribers that never verified their endpoint')]
class PrunePatchSubscribers extends Command
{
    /** Days an unverified subscriber may sit before it is removed. */
    private const int UNVERIFIED_GRACE_DAYS = 7;

    public function handle(): int
    {
        $deleted = PatchSubscriber::query()
            ->whereNull('verified_at')
            ->where('created_at', '<', now()->subDays(self::UNVERIFIED_GRACE_DAYS))
            ->delete();

        $this->info("Pruned {$deleted} unverified patch subscriber(s).");

        return self::SUCCESS;
    }
}
