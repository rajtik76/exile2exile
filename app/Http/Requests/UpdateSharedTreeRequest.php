<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Controllers\SharedTreeController;
use App\Models\SharedTree;

/**
 * Validates an edit to an existing shared tree. The shape and node-integrity rules
 * are inherited from {@see ShareTreeRequest}; this only adds the secret-token gate.
 * The token is never sent with the edit: {@see authorize()} returns false - a 403 -
 * unless the session was already unlocked for this build (see
 * {@see SharedTreeController::unlock()}), so the public slug alone can never mutate
 * a tree and the token stays out of every payload.
 */
class UpdateSharedTreeRequest extends ShareTreeRequest
{
    #[\Override]
    public function authorize(): bool
    {
        $build = $this->route('sharedTree');

        return $build instanceof SharedTree && $build->isUnlockedIn($this->session());
    }
}
