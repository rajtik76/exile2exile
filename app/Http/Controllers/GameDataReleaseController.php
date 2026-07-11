<?php

namespace App\Http\Controllers;

use App\Services\GameDataReleases;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The two HTTP faces of the game-data release pipeline.
 *
 * Download: CI fetches a staged release as a tarball to run the Contract suite
 * against it. Public - the same data is served by the site anyway.
 *
 * Activate: called by the data-contract workflow after a green run. Swaps the
 * `current` symlink to the validated release atomically; the app never serves a
 * release that has not passed the Contract suite. Guarded by a shared bearer
 * token and idempotent, so a re-run of the workflow is harmless.
 */
class GameDataReleaseController extends Controller
{
    public function download(GameDataReleases $releases, string $version): BinaryFileResponse
    {
        abort_unless(GameDataReleases::isValidVersion($version), 404);
        abort_unless(is_file($releases->tarballPath($version)), 404);

        return response()->download($releases->tarballPath($version));
    }

    /**
     * The release tarball's sha256, as plain text. CI keys its tarball cache on
     * this, so a re-extraction of the SAME patch (an extractor change) busts the
     * cache - the version.json `v` stamp only moves with the tree data.
     */
    public function checksum(GameDataReleases $releases, string $version): Response
    {
        abort_unless(GameDataReleases::isValidVersion($version), 404);

        $checksum = $releases->checksum($version);

        abort_if($checksum === null, 404);

        return response($checksum, 200, ['Content-Type' => 'text/plain']);
    }

    public function activate(Request $request, GameDataReleases $releases): JsonResponse
    {
        $token = config()->string('poe.data.activate_token', '');

        abort_if($token === '', 503, 'Activation is not configured.');
        abort_unless(hash_equals($token, (string) $request->bearerToken()), 401);

        $version = $request->string('version')->toString();

        abort_unless(GameDataReleases::isValidVersion($version), 422, 'Invalid version.');

        if ($releases->currentVersion() === $version) {
            return response()->json(['status' => 'already-active', 'version' => $version]);
        }

        abort_unless($releases->has($version), 404, "Release {$version} is not staged.");

        $releases->activate($version);
        $releases->prune();

        // poe.data_version (the cache-busting stamp for everything derived from
        // the game data) is computed at config-load time, so a cached config
        // would keep serving the pre-swap stamp. Rebuild it in place.
        if (app()->configurationIsCached()) {
            Artisan::call('config:cache');
        }

        return response()->json(['status' => 'activated', 'version' => $version]);
    }
}
