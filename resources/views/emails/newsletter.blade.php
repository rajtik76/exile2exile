<x-mail::message>
{!! $newsletter->body !!}

Thanks,<br>
{{ config('app.name') }}

<small>You are receiving this because you subscribed to the {{ config('app.name') }} newsletter. [Unsubscribe]({{ $unsubscribeUrl }})</small>
</x-mail::message>
