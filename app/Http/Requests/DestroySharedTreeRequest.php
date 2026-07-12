<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\SharedTree;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Deleting a shared tree is double-gated: the session must already be unlocked for
 * the build (like every edit), AND the author must re-type the secret edit token into
 * the delete form - a destructive action should not ride on a lingering unlock alone.
 *
 * The token travels only in this request's body (never a URL, so no server/proxy logs
 * or history), and it is excluded from the old-input session flash on a validation
 * failure, so the secret is never persisted anywhere on the way through.
 */
class DestroySharedTreeRequest extends FormRequest
{
    /** @var list<string> */
    protected $dontFlash = ['token'];

    public function authorize(): bool
    {
        $build = $this->route('sharedTree');

        return $build instanceof SharedTree && $build->isUnlockedIn($this->session());
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
        ];
    }
}
