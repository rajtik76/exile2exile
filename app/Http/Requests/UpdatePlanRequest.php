<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\BuildPlan;

/**
 * Validates an edit to an existing build plan. The shape rules are inherited from
 * {@see PlanRequest}; this only adds the secret-token gate. The token is never sent
 * with the edit: {@see authorize()} returns false - a 403 - unless the session was
 * already unlocked for this plan (see {@see PlannerController::unlock()}), so the public
 * slug alone can never mutate a guide and the token stays out of every payload.
 */
class UpdatePlanRequest extends PlanRequest
{
    #[\Override]
    public function authorize(): bool
    {
        $plan = $this->route('plan');

        return $plan instanceof BuildPlan && $plan->isUnlockedIn($this->session());
    }
}
