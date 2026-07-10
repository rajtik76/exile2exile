<?php

declare(strict_types=1);

use App\Models\PatchSubscriber;
use Illuminate\Support\Facades\Http;

it('verifies a subscriber that holds the secret and echoes the challenge', function () {
    Http::fake(fn ($request) => Http::response($request['challenge']));
    $subscriber = PatchSubscriber::factory()->create(['url' => 'https://1.1.1.1/hook', 'secret' => 'sec-token']);

    $this->postJson("/api/patch/subscribers/{$subscriber->id}/verify", [], ['X-Poe2-Secret' => 'sec-token'])
        ->assertOk()
        ->assertJson(['verified' => true]);

    expect($subscriber->fresh()->verified_at)->not->toBeNull();
});

it('rejects verify and unsubscribe without the correct secret', function () {
    $subscriber = PatchSubscriber::factory()->create(['secret' => 'right']);

    $this->postJson("/api/patch/subscribers/{$subscriber->id}/verify", [], ['X-Poe2-Secret' => 'wrong'])
        ->assertStatus(403);
    $this->deleteJson("/api/patch/subscribers/{$subscriber->id}", [], ['X-Poe2-Secret' => 'wrong'])
        ->assertStatus(403);

    expect(PatchSubscriber::find($subscriber->id))->not->toBeNull();
});

it('unsubscribes when the secret matches', function () {
    $subscriber = PatchSubscriber::factory()->create(['secret' => 'sec-token']);

    $this->deleteJson("/api/patch/subscribers/{$subscriber->id}", [], ['X-Poe2-Secret' => 'sec-token'])
        ->assertOk()
        ->assertJson(['unsubscribed' => true]);

    expect(PatchSubscriber::find($subscriber->id))->toBeNull();
});
