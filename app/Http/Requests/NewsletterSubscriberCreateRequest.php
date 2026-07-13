<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Captchaapi\Laravel\Facades\Captchaapi;
use Captchaapi\Laravel\Rules\ValidCaptcha;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\RequiredIf;

class NewsletterSubscriberCreateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * No unique rule on purpose: a "taken" error would let anyone probe which
     * addresses are subscribed, and would dead-end users whose confirmation
     * mail was lost. Duplicates are handled idempotently by
     * CreateNewsletterSubscriber instead.
     *
     * captchaapi_response is only required when CAPTCHAAPI_ENABLED is true
     * (a plain 'required' would reject every signup once local dev / CI
     * disables the widget, since the frontend never populates the field).
     * No 'string' rule: Laravel's ConvertEmptyStringsToNull middleware turns
     * the frontend's default empty string into null before validation runs,
     * and 'string' rejects null outright even though the field is optional.
     * ValidCaptcha does its own is_string()/empty check internally and
     * passes silently when disabled, so the two checks agree either way.
     *
     * @return array<string, list<string|RequiredIf|ValidCaptcha>>
     */
    public function rules(): array
    {
        return [
            'email' => [
                'required',
                'string',
                'email',
                'max:254',
            ],
            'captchaapi_response' => [
                Rule::requiredIf(fn (): bool => Captchaapi::enabled()),
                new ValidCaptcha,
            ],
        ];
    }
}
