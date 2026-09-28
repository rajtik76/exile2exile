<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Http\Controllers\SharedTreeController;
use App\Models\SharedTree;
use App\Pob\Reference\BuildReference;
use App\Rules\LiveGameEra;
use Illuminate\Contracts\Validation\Validator;

/**
 * Validates an edit to an existing shared tree. The shape and node-integrity rules
 * are inherited from {@see ShareTreeRequest}; this only adds the secret-token gate.
 * The token is never sent with the edit: {@see authorize()} returns false - a 403 -
 * unless the session was already unlocked for this build (see
 * {@see SharedTreeController::unlock()}), so the public slug alone can never mutate
 * a tree and the token stays out of every payload.
 *
 * A tree from an older game era is read-only. That is a validation failure, not an
 * authorisation one: an unlocked editor left open across a swap to a new era gets
 * the same "reload the page" message as a first save would, instead of a bare 403.
 */
class UpdateSharedTreeRequest extends ShareTreeRequest
{
    #[\Override]
    public function authorize(): bool
    {
        $build = $this->route('sharedTree');

        return $build instanceof SharedTree && $build->isUnlockedIn($this->session());
    }

    /**
     * @return array<int, callable>
     */
    #[\Override]
    public function after(BuildReference $reference): array
    {
        return [
            function (Validator $validation): void {
                $build = $this->route('sharedTree');

                if ($build instanceof SharedTree && ! $build->isFromCurrentEra()) {
                    $validation->errors()->add('gamePatch', LiveGameEra::MESSAGE);
                }
            },
            ...parent::after($reference),
        ];
    }
}
