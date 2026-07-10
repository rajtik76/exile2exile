<?php

declare(strict_types=1);

namespace App\Support\Http;

use App\Rules\PublicHttpsUrl;
use InvalidArgumentException;

/**
 * The single SSRF gate for an outbound request to a user-supplied URL. Resolves the
 * host and asserts it points at a public address, returning the resolved IP so the
 * caller can pin the connection to it (CURLOPT_RESOLVE) - closing the DNS-rebinding
 * window between this check and the request. Shared by the webhook senders and the
 * {@see PublicHttpsUrl} form rule, so signup-time and send-time checks
 * can never drift apart.
 */
final class PublicUrlGuard
{
    /**
     * @return array{host: string, ip: string, port: int} the host, its resolved public IP, and the effective port
     *
     * @throws InvalidArgumentException when the URL is not https or does not resolve to a public address
     */
    public function assertPublic(string $url): array
    {
        $parts = parse_url(trim($url));

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host'])) {
            throw new InvalidArgumentException('The URL must be an https URL.');
        }

        $host = $parts['host'];
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new InvalidArgumentException('The URL must resolve to a public address.');
        }

        return ['host' => $host, 'ip' => $ip, 'port' => is_int($parts['port'] ?? null) ? $parts['port'] : 443];
    }
}
