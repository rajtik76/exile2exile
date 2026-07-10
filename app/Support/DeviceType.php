<?php

namespace App\Support;

/**
 * The coarse device class a page view came from, derived from the User-Agent.
 *
 * We deliberately keep only three buckets: storing the full UA would defeat the
 * cookieless, no-PII design of the page_views table, and for an audience read-out
 * "mobile vs tablet vs desktop" is all the resolution we need. Crawlers never
 * reach here - TrackPageView drops them before this is called.
 */
enum DeviceType: string
{
    case Mobile = 'mobile';
    case Tablet = 'tablet';
    case Desktop = 'desktop';

    /**
     * Classify a User-Agent string. Tablets are checked before phones because
     * many tablet UAs ("iPad", Android tablets) also carry generic mobile
     * tokens; an empty or unrecognised UA falls back to desktop.
     */
    public static function fromUserAgent(?string $userAgent): self
    {
        $ua = $userAgent ?? '';

        if ($ua === '') {
            return self::Desktop;
        }

        if (self::isTablet($ua)) {
            return self::Tablet;
        }

        if (self::isMobile($ua)) {
            return self::Mobile;
        }

        return self::Desktop;
    }

    /**
     * iPadOS 13+ reports a desktop Safari UA, so we also treat a Macintosh that
     * advertises touch support as a tablet.
     */
    private static function isTablet(string $ua): bool
    {
        if (preg_match('/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i', $ua) === 1) {
            return true;
        }

        return str_contains($ua, 'Macintosh') && str_contains($ua, 'Mobile');
    }

    private static function isMobile(string $ua): bool
    {
        return preg_match('/Mobile|iPhone|iPod|Android|BlackBerry|IEMobile|Opera Mini|webOS/i', $ua) === 1;
    }
}
