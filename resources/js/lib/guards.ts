/**
 * Tiny structural guards for data crossing a trust boundary - fetch responses
 * and localStorage. They check just enough shape for the code that consumes
 * the value; full semantic validation stays on the server.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNumberArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'number')
    );
}
