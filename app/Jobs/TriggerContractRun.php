<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Asks GitHub Actions to validate a staged game-data release.
 *
 * Dispatches the data-contract workflow with the staged version and its
 * tarball checksum; the workflow downloads the tarball from this app, verifies
 * the checksum, runs the Contract suite against it, and on green calls the
 * activation endpoint to swap the release live. No-ops when no dispatch token
 * is configured (e.g. locally).
 */
class TriggerContractRun implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(
        public string $version,
        public string $checksum,
    ) {}

    /**
     * Seconds to wait between retries.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(): void
    {
        $token = config()->string('services.github.token', '');

        if ($token === '') {
            Log::info('Skipping contract-run dispatch: no GitHub dispatch token configured.');

            return;
        }

        $repository = config()->string('services.github.repository');
        $workflow = config()->string('services.github.workflow');

        Http::withToken($token)
            ->withHeaders([
                'Accept' => 'application/vnd.github+json',
                'X-GitHub-Api-Version' => '2022-11-28',
            ])
            ->connectTimeout(5)
            ->timeout(15)
            ->post("https://api.github.com/repos/{$repository}/actions/workflows/{$workflow}/dispatches", [
                'ref' => config()->string('services.github.ref'),
                'inputs' => [
                    'version' => $this->version,
                    'sha256' => $this->checksum,
                ],
            ])
            ->throw();
    }
}
