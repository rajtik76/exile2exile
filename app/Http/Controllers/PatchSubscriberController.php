<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePatchSubscriberRequest;
use App\Models\PatchSubscriber;
use App\Support\Http\PublicUrlGuard;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Lets anyone subscribe a webhook to the "new PoE2 patch" signal.
 *
 * Flow: POST a URL -> we create the subscriber and send a signed verification
 * ping; the endpoint proves ownership by echoing the challenge. Verified
 * subscribers then receive a signed POST whenever a new patch releases.
 */
class PatchSubscriberController extends Controller
{
    public function __construct(private readonly PublicUrlGuard $guard) {}

    public function store(StorePatchSubscriberRequest $request): JsonResponse
    {
        try {
            $subscriber = PatchSubscriber::query()->create([
                'url' => $request->validated('url'),
                'secret' => Str::random(48),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Two identical URLs raced past the unique validation; the first one won.
            return response()->json(['message' => 'This URL is already subscribed.'], 409);
        }

        $verified = $this->attemptVerification($subscriber);

        return response()->json([
            'id' => $subscriber->id,
            'url' => $subscriber->url,
            'secret' => $subscriber->secret, // shown once - use it to verify the HMAC signature
            'verified' => $verified,
            'message' => $verified
                ? 'Subscribed. You will receive a signed POST when a new PoE2 patch releases.'
                : 'Created, but the verification ping did not echo the challenge. Fix your endpoint, then call verify with your secret.',
        ], 201);
    }

    public function verify(PatchSubscriber $subscriber, Request $request): JsonResponse
    {
        $this->authorizeSecret($subscriber, $request);

        return response()->json(['verified' => $this->attemptVerification($subscriber)]);
    }

    public function destroy(PatchSubscriber $subscriber, Request $request): JsonResponse
    {
        $this->authorizeSecret($subscriber, $request);
        $subscriber->delete();

        return response()->json(['unsubscribed' => true]);
    }

    /** Confirm the caller holds the subscriber's secret (timing-safe). */
    private function authorizeSecret(PatchSubscriber $subscriber, Request $request): void
    {
        abort_unless(hash_equals($subscriber->secret, (string) $request->header('X-Poe2-Secret')), 403);
    }

    /**
     * Send a signed challenge to the endpoint; it is verified if it answers 2xx
     * and echoes the challenge back, proving the subscriber controls the URL.
     */
    private function attemptVerification(PatchSubscriber $subscriber): bool
    {
        $challenge = Str::random(40);
        $body = (string) json_encode(['event' => 'verification', 'challenge' => $challenge], JSON_UNESCAPED_SLASHES);

        try {
            // Re-validate and pin the host at send time, not just at signup (DNS rebinding).
            $target = $this->guard->assertPublic($subscriber->url);
            $response = Http::connectTimeout(5)
                ->timeout(10)
                ->withoutRedirecting()
                ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$target['host']}:{$target['port']}:{$target['ip']}"]]])
                ->withBody($body, 'application/json')
                ->withHeaders([
                    'X-Poe2-Event' => 'verification',
                    'X-Poe2-Signature' => 'sha256='.hash_hmac('sha256', $body, $subscriber->secret),
                ])
                ->post($subscriber->url);
        } catch (Throwable) {
            return false;
        }

        if ($response->successful() && str_contains($response->body(), $challenge)) {
            // verified_at is not mass-assignable (guards against self-verify), so set it directly.
            $subscriber->verified_at = now();
            $subscriber->save();

            return true;
        }

        return false;
    }
}
