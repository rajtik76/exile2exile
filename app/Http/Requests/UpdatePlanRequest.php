<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\BuildPlan;
use App\Rules\LiveGameEra;
use Illuminate\Contracts\Validation\Validator;

/**
 * Validates an edit to an existing build plan. The shape rules are inherited from
 * {@see PlanRequest}; this only adds the secret-token gate. The token is never sent
 * with the edit: {@see authorize()} returns false - a 403 - unless the session was
 * already unlocked for this plan (see {@see PlannerController::unlock()}), so the public
 * slug alone can never mutate a guide and the token stays out of every payload.
 *
 * A plan from an older game era is read-only. That is a validation failure, not an
 * authorisation one: an unlocked editor left open across a swap to a new era gets
 * the same "reload the page" message as a first save would, instead of a bare 403.
 */
class UpdatePlanRequest extends PlanRequest
{
    #[\Override]
    public function authorize(): bool
    {
        $plan = $this->route('plan');

        return $plan instanceof BuildPlan && $plan->isUnlockedIn($this->session());
    }

    /**
     * @return array<int, callable>
     */
    #[\Override]
    public function after(): array
    {
        return [
            function (Validator $validation): void {
                $plan = $this->route('plan');

                if ($plan instanceof BuildPlan && ! $plan->isFromCurrentEra()) {
                    $validation->errors()->add('gamePatch', LiveGameEra::MESSAGE);
                }
            },
            ...parent::after(),
        ];
    }
}
