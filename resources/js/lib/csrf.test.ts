import { afterEach, expect, test } from 'vitest';
import { xsrfToken } from '@/lib/csrf';

afterEach(() => {
    // Expire whatever cookie a test set so cases don't bleed into each other.
    document.cookie = 'XSRF-TOKEN=;max-age=0;path=/';
});

test('returns an empty string when no XSRF cookie is present', () => {
    expect(xsrfToken()).toBe('');
});

test('reads and url-decodes the XSRF cookie value', () => {
    document.cookie = 'XSRF-TOKEN=ab%3Dcd';

    expect(xsrfToken()).toBe('ab=cd');
});
