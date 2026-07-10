<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Pob\Data\BuildSnapshot;
use App\Pob\PobImport;
use App\Pob\Source\BuildSourceRegistry;
use App\Pob\Validation\BuildValidator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use InvalidArgumentException;

/**
 * Validates a Path of Building export code (or pobb.in link) being imported into the
 * build planner. The input must resolve, decode and be valid for the current league;
 * the decoded snapshot is stashed so the controller maps it into a plan without
 * re-resolving (and re-fetching) the code.
 *
 * No auth: importing a build is a guest action, like the rest of the planner.
 */
class ImportPlanRequest extends FormRequest
{
    private ?BuildSnapshot $snapshot = null;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:'.PobImport::MAX_CODE_BYTES],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(BuildValidator $buildValidator, BuildSourceRegistry $sources): array
    {
        return [
            function (Validator $validation) use ($buildValidator, $sources): void {
                if ($validation->errors()->isNotEmpty()) {
                    return;
                }

                try {
                    $code = $sources->resolveCode((string) $this->input('code'));
                } catch (InvalidArgumentException $e) {
                    $validation->errors()->add(
                        'code',
                        str_contains($e->getMessage(), 'pobb.in')
                            ? $e->getMessage()
                            : 'This is not a valid Path of Building 2 export code or pobb.in link.',
                    );

                    return;
                }

                $validity = $buildValidator->validate($code);

                if (! $validity->valid) {
                    foreach ($validity->errors as $message) {
                        $validation->errors()->add('code', $message);
                    }

                    return;
                }

                $this->snapshot = $validity->snapshot;
            },
        ];
    }

    /**
     * The decoded, validated build resolved during validation.
     */
    public function snapshot(): BuildSnapshot
    {
        return $this->snapshot ?? throw new InvalidArgumentException('The build snapshot is only available after validation passes.');
    }
}
