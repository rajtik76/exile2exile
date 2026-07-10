<?php

use App\Http\Controllers\PatchSubscriberController;
use Illuminate\Support\Facades\Route;

// Public "new PoE2 patch" webhook subscription. Subscribe a URL, prove you own
// it (the verification ping must echo the challenge), and receive a signed POST
// when a new patch releases.
Route::middleware('throttle:20,1')->group(function (): void {
    Route::post('patch/subscribers', [PatchSubscriberController::class, 'store']);
    Route::post('patch/subscribers/{subscriber}/verify', [PatchSubscriberController::class, 'verify']);
    Route::delete('patch/subscribers/{subscriber}', [PatchSubscriberController::class, 'destroy']);
});
