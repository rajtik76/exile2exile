<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Lists and fetches the `.lua` files under PoB's `Data/Uniques` directory from GitHub - the
 * repo, path and ref are all config-driven (poe.pob_uniques), so a rename or fork needs no
 * code change. Public repo: works unauthenticated, but the api.github.com calls honour
 * services.github.token when set (raises the otherwise-shared 60 req/hour rate limit). The
 * token is never sent to the raw-content download - that host (raw.githubusercontent.com)
 * needs no auth for a public repo, and the token is shared with unrelated write-scoped
 * calls elsewhere (TriggerContractRun's repository_dispatch), so it must not leak to a
 * different host than the GitHub API it was issued for.
 */
final class PobUniquesGithubSource
{
    /**
     * The commit SHA the configured ref currently resolves to - the persisted snapshot
     * records this (not the mutable ref name) so a bad sync can be traced to the exact
     * upstream commit that produced it.
     *
     * @throws RuntimeException on a non-2xx response or an unexpected payload shape.
     */
    public function resolveRef(): string
    {
        $repo = config()->string('poe.pob_uniques.repo');
        $ref = config()->string('poe.pob_uniques.ref');

        $response = $this->apiClient()->get("https://api.github.com/repos/{$repo}/commits/{$ref}");

        if ($response->failed()) {
            throw new RuntimeException("GitHub commit lookup failed ({$response->status()}) for {$repo}@{$ref}.");
        }

        $sha = $response->json('sha');

        if (! is_string($sha) || $sha === '') {
            throw new RuntimeException("GitHub commit lookup for {$repo}@{$ref} returned no sha.");
        }

        return $sha;
    }

    /**
     * The `.lua` files in the configured directory, newest GitHub API listing.
     *
     * @return list<array{name: string, downloadUrl: string}>
     *
     * @throws RuntimeException on a non-2xx response or an unexpected payload shape.
     */
    public function listFiles(): array
    {
        $repo = config()->string('poe.pob_uniques.repo');
        $path = config()->string('poe.pob_uniques.path');
        $ref = config()->string('poe.pob_uniques.ref');

        $response = $this->apiClient()
            ->get("https://api.github.com/repos/{$repo}/contents/{$path}", ['ref' => $ref]);

        if ($response->failed()) {
            throw new RuntimeException("GitHub contents listing failed ({$response->status()}) for {$repo}/{$path}@{$ref}.");
        }

        $entries = $response->json();

        if (! is_array($entries)) {
            throw new RuntimeException("GitHub contents listing for {$repo}/{$path}@{$ref} returned an unexpected payload.");
        }

        $files = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $name = $entry['name'] ?? null;
            $downloadUrl = $entry['download_url'] ?? null;
            $type = $entry['type'] ?? null;

            if ($type === 'file' && is_string($name) && str_ends_with($name, '.lua') && is_string($downloadUrl)) {
                $files[] = ['name' => $name, 'downloadUrl' => $downloadUrl];
            }
        }

        return $files;
    }

    /**
     * Downloads raw file content directly from its `download_url` - never through
     * {@see apiClient()}, so the GitHub API token never reaches that host.
     *
     * @throws RuntimeException on a non-2xx response.
     */
    public function fetch(string $downloadUrl): string
    {
        $response = $this->rawClient()->get($downloadUrl);

        if ($response->failed()) {
            throw new RuntimeException("Failed to download {$downloadUrl} ({$response->status()}).");
        }

        return $response->body();
    }

    /** Used only for api.github.com calls - the only host allowed to see the token. */
    private function apiClient(): PendingRequest
    {
        $token = config()->string('services.github.token');

        $request = Http::withHeaders([
            'Accept' => 'application/vnd.github+json',
            'X-GitHub-Api-Version' => '2022-11-28',
            'User-Agent' => 'ExileToExile-pob-uniques-sync',
        ])->connectTimeout(5)->timeout(30);

        return $token === '' ? $request : $request->withToken($token);
    }

    /** Used for raw-content downloads. Deliberately carries no auth token. */
    private function rawClient(): PendingRequest
    {
        return Http::withHeaders([
            'User-Agent' => 'ExileToExile-pob-uniques-sync',
        ])->connectTimeout(5)->timeout(30);
    }
}
