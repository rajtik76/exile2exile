<?php

namespace App\Services;

use RuntimeException;

/**
 * Reads the current Path of Exile 2 game version from the official patch server.
 *
 * GGG exposes no webhook for new patches, but the patch server announces the
 * current version over a tiny TCP protocol: connect, send the two-byte handshake
 * [0x01, 0x07], and the server replies with a packet that embeds the CDN base
 * URL (UTF-16LE), e.g. "https://patch-poe2.poecdn.com/4.5.3.1.7/". The version is
 * the path segment of that URL.
 *
 * Layout of the reply: byte 0 is a tag, bytes 1..33 a field we ignore, the next
 * byte is the URL length in UTF-16 code units, and the URL follows in UTF-16LE.
 */
class Poe2PatchServer
{
    public function __construct(
        private readonly string $host = 'patch.pathofexile2.com',
        private readonly int $port = 13060,
        private readonly int $timeout = 8,
    ) {}

    /**
     * The current PoE2 patch version, e.g. "4.5.3.1.7".
     *
     * @throws RuntimeException when the server is unreachable or the reply cannot be parsed
     */
    public function currentVersion(): string
    {
        $socket = @stream_socket_client("tcp://{$this->host}:{$this->port}", $errno, $errstr, $this->timeout);

        if ($socket === false) {
            throw new RuntimeException("patch server unreachable: {$errstr} ({$errno})");
        }

        try {
            stream_set_timeout($socket, $this->timeout);
            fwrite($socket, "\x01\x07");

            return $this->parseVersion($this->readReply($socket));
        } finally {
            fclose($socket);
        }
    }

    /**
     * Read from the socket until the announced URL has fully arrived.
     *
     * @param  resource  $socket
     */
    private function readReply($socket): string
    {
        $marker = mb_convert_encoding('https://', 'UTF-16LE', 'UTF-8');
        $buffer = '';

        while (! feof($socket)) {
            $chunk = fread($socket, 1024);

            if ($chunk === '' || $chunk === false) {
                break;
            }

            $buffer .= $chunk;
            $start = strpos($buffer, $marker);

            if ($start === false || $start < 1) {
                continue;
            }

            $length = ord($buffer[$start - 1]) * 2; // UTF-16 code units -> bytes

            if (strlen($buffer) >= $start + $length) {
                return substr($buffer, $start, $length);
            }
        }

        throw new RuntimeException('patch server returned no version');
    }

    private function parseVersion(string $utf16Url): string
    {
        $url = mb_convert_encoding($utf16Url, 'UTF-8', 'UTF-16LE');

        if (! preg_match('#/(\d[\d.]*\d)/?$#', $url, $matches)) {
            throw new RuntimeException("could not parse version from \"{$url}\"");
        }

        return $matches[1];
    }
}
