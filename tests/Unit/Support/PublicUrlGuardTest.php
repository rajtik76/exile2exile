<?php

declare(strict_types=1);

use App\Support\Http\PublicUrlGuard;

it('accepts a public https URL and returns the pinned target', function () {
    // 1.1.1.1 is a stable public IP literal, so no DNS lookup is needed.
    $target = (new PublicUrlGuard)->assertPublic('https://1.1.1.1/hook');

    expect($target)->toBe(['host' => '1.1.1.1', 'ip' => '1.1.1.1', 'port' => 443]);
});

it('carries an explicit port through', function () {
    expect((new PublicUrlGuard)->assertPublic('https://1.1.1.1:8443/hook')['port'])->toBe(8443);
});

it('rejects non-https and internal / reserved addresses', function (string $url) {
    expect(fn () => (new PublicUrlGuard)->assertPublic($url))
        ->toThrow(InvalidArgumentException::class);
})->with([
    'http' => 'http://1.1.1.1/hook',
    'loopback' => 'https://127.0.0.1/hook',
    'link-local meta' => 'https://169.254.169.254/latest/meta-data',
    'private 10.x' => 'https://10.0.0.1/hook',
    'private 192.168' => 'https://192.168.1.1/hook',
    'not a url' => 'nonsense',
    'empty' => '',
]);
