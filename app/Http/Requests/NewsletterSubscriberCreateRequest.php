<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
     * @return array<string, list<string>>
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
        ];
    }
}
