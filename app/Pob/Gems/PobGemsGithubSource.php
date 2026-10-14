<?php

declare(strict_types=1);

namespace App\Pob\Gems;

use App\Pob\Uniques\PobUniquesGithubSource;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Fetches PoB's `Data/Gems.lua` from GitHub - repo, path and ref come from poe.pob_gems.
 * Same token rules as {@see PobUniquesGithubSource}: services.github.token goes to
 * api.github.com only, never to the raw-content host.
 */
final class PobGemsGithubSource
{
    /**
     * The commit SHA the configured ref currently resolves to, recorded in the snapshot so
     * a bad sync can be traced to the exact upstream commit.
     *
     * @throws RuntimeException on a non-2xx response or an unexpected payload shape.
     */
    public function resolveRef(): string
    {
        $repo = config()->string('poe.pob_gems.repo');
        $ref = config()->string('poe.pob_gems.ref');

        $token = config()->string('services.github.token');
        $request = Http::withHeaders([
            'Accept' => 'application/vnd.github+json',
            'X-GitHub-Api-Version' => '2022-11-28',
            'User-Agent' => 'ExileToExile-pob-gems-sync',
        ])->connectTimeout(5)->timeout(30);

        $response = ($token === '' ? $request : $request->withToken($token))
            ->get("https://api.github.com/repos/{$repo}/commits/{$ref}");

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
     * The raw `Gems.lua` content at the configured ref.
     *
     * @throws RuntimeException on a non-2xx response.
     */
    public function fetch(): string
    {
        $repo = config()->string('poe.pob_gems.repo');
        $path = ltrim(config()->string('poe.pob_gems.path'), '/');
        $ref = config()->string('poe.pob_gems.ref');
        $url = "https://raw.githubusercontent.com/{$repo}/{$ref}/{$path}";

        $response = $this->rawClient()->get($url);

        if ($response->failed()) {
            throw new RuntimeException("Failed to download {$url} ({$response->status()}).");
        }

        return $response->body();
    }

    /** Used for raw-content downloads. Deliberately carries no auth token. */
    private function rawClient(): PendingRequest
    {
        return Http::withHeaders([
            'User-Agent' => 'ExileToExile-pob-gems-sync',
        ])->connectTimeout(5)->timeout(30);
    }
}
