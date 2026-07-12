<x-mail::message>
# Confirm your subscription

Click the button below to confirm you want to receive the {{ config('app.name') }} newsletter.

<x-mail::button :url="$confirmUrl">
Confirm subscription
</x-mail::button>

If you did not sign up, you can safely ignore this email and you will not hear from us again.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
