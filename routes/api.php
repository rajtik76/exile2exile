<?php

use App\Http\Controllers\GameDataReleaseController;
use App\Http\Controllers\PatchSubscriberController;
use Illuminate\Support\Facades\Route;

// Game-data release pipeline: CI downloads a staged release tarball, runs the
// Contract suite on it, and on green calls activate to swap it live. The
// download is public (the site serves the same data); activation requires the
// shared bearer token.
Route::get('data/releases/{version}.tar.gz', [GameDataReleaseController::class, 'download'])
    ->where('version', '[0-9]+(?:\.[0-9]+)*');
Route::get('data/releases/{version}.tar.gz.sha256', [GameDataReleaseController::class, 'checksum'])
    ->where('version', '[0-9]+(?:\.[0-9]+)*');
Route::post('data/activate', [GameDataReleaseController::class, 'activate'])
    ->middleware('throttle:10,1');

// Public "new PoE2 patch" webhook subscription. Subscribe a URL, prove you own
// it (the verification ping must echo the challenge), and receive a signed POST
// when a new patch releases.
Route::middleware('throttle:20,1')->group(function (): void {
    Route::post('patch/subscribers', [PatchSubscriberController::class, 'store']);
    Route::post('patch/subscribers/{subscriber}/verify', [PatchSubscriberController::class, 'verify']);
    Route::delete('patch/subscribers/{subscriber}', [PatchSubscriberController::class, 'destroy']);
});
