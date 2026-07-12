<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Controllers\SharedBuildController;
use App\Models\SharedBuild;

/**
 * Validates an edit to an existing shared tree. The shape and node-integrity rules
 * are inherited from {@see ShareBuildRequest}; this only adds the secret-token gate.
 * The token is never sent with the edit: {@see authorize()} returns false - a 403 -
 * unless the session was already unlocked for this build (see
 * {@see SharedBuildController::unlock()}), so the public slug alone can never mutate
 * a tree and the token stays out of every payload.
 */
class UpdateSharedBuildRequest extends ShareBuildRequest
{
    #[\Override]
    public function authorize(): bool
    {
        $build = $this->route('sharedBuild');

        return $build instanceof SharedBuild && $build->isUnlockedIn($this->session());
    }
}
