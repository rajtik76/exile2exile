import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

// Hoisted so the mock factories (themselves hoisted above imports) can reach them.
const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    transform: vi.fn(),
    solve: vi.fn(),
    state: {
        errors: {} as Record<string, string>,
        processing: false,
        solving: false,
        captchaError: null as { code: string } | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<object>();
    const React = await import('react');

    return {
        ...original,
        Head: () => null,
        usePage: () => ({ props: { name: 'Exile to Exile' } }),
        useForm: (initial: Record<string, unknown>) => {
            const [data, setData] = React.useState(initial);

            return {
                data,
                setData: (key: string, value: unknown) =>
                    setData((previous) => ({ ...previous, [key]: value })),
                transform: mocks.transform,
                post: mocks.post,
                processing: mocks.state.processing,
                errors: mocks.state.errors,
            };
        },
    };
});

vi.mock('@captchaapi/react', () => ({
    useCaptcha: () => ({
        solve: mocks.solve,
        solving: mocks.state.solving,
        error: mocks.state.captchaError,
    }),
}));

const Newsletter = (await import('@/pages/newsletter')).default;

beforeEach(() => {
    mocks.post.mockClear();
    mocks.transform.mockClear();
    mocks.solve.mockReset();
    mocks.state.errors = {};
    mocks.state.processing = false;
    mocks.state.solving = false;
    mocks.state.captchaError = null;
});

function fillEmail(email: string): void {
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: email },
    });
}

test('posts directly without solving when captcha is disabled', async () => {
    render(<Newsletter captchaEnabled={false} />);

    fillEmail('exile@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.solve).not.toHaveBeenCalled();
    expect(mocks.transform).not.toHaveBeenCalled();
});

test('solves the captcha and merges the response before posting when enabled', async () => {
    mocks.solve.mockResolvedValue('token.12345');

    render(<Newsletter captchaEnabled={true} />);

    fillEmail('exile@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.solve).toHaveBeenCalledTimes(1);
    expect(mocks.transform).toHaveBeenCalledTimes(1);

    const transformCallback = mocks.transform.mock.calls[0][0];
    expect(
        transformCallback({
            email: 'exile@example.com',
            captchaapi_response: '',
        }),
    ).toEqual({
        email: 'exile@example.com',
        captchaapi_response: 'token.12345',
    });
});

test('does not submit when solve() rejects', async () => {
    mocks.solve.mockRejectedValue(
        Object.assign(new Error('rate_limited'), { code: 'rate_limited' }),
    );

    render(<Newsletter captchaEnabled={true} />);

    fillEmail('exile@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await vi.waitFor(() => expect(mocks.solve).toHaveBeenCalledTimes(1));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.transform).not.toHaveBeenCalled();
});

test('shows the captcha error message when the hook reports one', () => {
    mocks.state.captchaError = { code: 'rate_limited' };

    render(<Newsletter captchaEnabled={true} />);

    expect(
        screen.getByText('Captcha verification failed, please try again.'),
    ).toBeTruthy();
});

test('prefers the server-side captchaapi_response error over the client one', () => {
    mocks.state.captchaError = { code: 'rate_limited' };
    mocks.state.errors = {
        captchaapi_response: 'Captcha verification failed.',
    };

    render(<Newsletter captchaEnabled={true} />);

    expect(screen.getByText('Captcha verification failed.')).toBeTruthy();
});

test('disables the submit button and shows progress while solving', () => {
    mocks.state.solving = true;

    render(<Newsletter captchaEnabled={true} />);
    fillEmail('exile@example.com');

    const button = screen.getByRole('button', {
        name: 'Verifying…',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
});

test('shows the captchaapi.eu badge only when captcha is enabled', () => {
    const { rerender } = render(<Newsletter captchaEnabled={true} />);
    expect(screen.getByText('captchaapi.eu')).toBeTruthy();

    rerender(<Newsletter captchaEnabled={false} />);
    expect(screen.queryByText('captchaapi.eu')).toBeNull();
});
