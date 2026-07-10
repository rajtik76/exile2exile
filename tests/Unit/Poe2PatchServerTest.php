<?php

declare(strict_types=1);

use App\Services\Poe2PatchServer;

/** A readable stream primed with the given bytes, standing in for the patch-server socket. */
function poe2PatchStream(string $bytes)
{
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $bytes);
    rewind($stream);

    return $stream;
}

function poe2Invoke(object $object, string $method, mixed ...$args): mixed
{
    return new ReflectionMethod($object, $method)->invoke($object, ...$args);
}

/** A well-formed reply: a tag byte, a UTF-16 length byte, then the URL in UTF-16LE. */
function poe2Reply(string $url): string
{
    return "\x99".chr(strlen($url)).mb_convert_encoding($url, 'UTF-16LE', 'UTF-8');
}

it('parses the version out of a well-formed patch-server reply', function () {
    $server = new Poe2PatchServer;
    $raw = poe2Invoke($server, 'readReply', poe2PatchStream(poe2Reply('https://patch-poe2.poecdn.com/4.5.3.1.7/')));

    expect(poe2Invoke($server, 'parseVersion', $raw))->toBe('4.5.3.1.7');
});

it('rejects a reply with no https marker', function () {
    expect(fn () => poe2Invoke(new Poe2PatchServer, 'readReply', poe2PatchStream("\x00\x01\x02garbage")))
        ->toThrow(RuntimeException::class, 'no version');
});

it('rejects a truncated url that never completes', function () {
    $utf16 = mb_convert_encoding('https://patch-poe2.poecdn.com/4.5.3.1.7/', 'UTF-16LE', 'UTF-8');
    // length byte claims the full url, but only a few of its bytes ever arrive
    $reply = "\x99".chr(40).substr($utf16, 0, 12);

    expect(fn () => poe2Invoke(new Poe2PatchServer, 'readReply', poe2PatchStream($reply)))
        ->toThrow(RuntimeException::class, 'no version');
});

it('rejects a url that carries no version segment', function () {
    $utf16 = mb_convert_encoding('https://patch-poe2.poecdn.com/', 'UTF-16LE', 'UTF-8');

    expect(fn () => poe2Invoke(new Poe2PatchServer, 'parseVersion', $utf16))
        ->toThrow(RuntimeException::class, 'could not parse');
});

it('throws when the patch server is unreachable', function () {
    // Port 1 on loopback refuses immediately - no real network wait.
    expect(fn () => new Poe2PatchServer('127.0.0.1', 1, 1)->currentVersion())
        ->toThrow(RuntimeException::class, 'unreachable');
});
