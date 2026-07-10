/** Read Laravel's XSRF cookie so a bare `fetch` POST passes CSRF, like an Inertia visit. */
export function xsrfToken(): string {
    if (typeof document === 'undefined') {
        return '';
    }

    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}
