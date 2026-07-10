import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

// Hoisted so the mock factory (itself hoisted above imports) can reach them.
const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    state: { errors: {} as Record<string, string>, processing: false },
}));

vi.mock('@inertiajs/react', async () => {
    const React = await import('react');

    return {
        Head: () => null,
        useForm: (initial: Record<string, unknown>) => {
            const [data, setData] = React.useState(initial);

            return {
                data,
                setData: (key: string, value: unknown) =>
                    setData((previous) => ({ ...previous, [key]: value })),
                post: mocks.post,
                processing: mocks.state.processing,
                errors: mocks.state.errors,
            };
        },
    };
});

const PlannerUnlock = (await import('@/pages/planner/unlock')).default;

beforeEach(() => {
    mocks.post.mockClear();
    mocks.state.errors = {};
    mocks.state.processing = false;
});

test('the unlock button is disabled until a token is typed', () => {
    render(<PlannerUnlock slug="abc123" title="My Build" />);

    const button = screen.getByRole('button', {
        name: 'Unlock',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Paste your edit token…'), {
        target: { value: 'my-token' },
    });

    expect(button.disabled).toBe(false);
});

test('submitting posts the token to the unlock route', () => {
    render(<PlannerUnlock slug="abc123" title="My Build" />);

    fireEvent.change(screen.getByPlaceholderText('Paste your edit token…'), {
        target: { value: 'my-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][0]).toContain(
        '/build-planner/abc123/unlock',
    );
});

test('a wrong token surfaces the server error', () => {
    mocks.state.errors = {
        token: 'That edit token is not valid for this build.',
    };

    render(<PlannerUnlock slug="abc123" title="My Build" />);

    expect(
        screen.getByText('That edit token is not valid for this build.'),
    ).toBeTruthy();
});

test('while unlocking the button shows progress and stays disabled', () => {
    mocks.state.processing = true;

    render(<PlannerUnlock slug="abc123" title="My Build" />);

    const button = screen.getByRole('button', {
        name: 'Unlocking…',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
});

test('an untitled build falls back to a placeholder name', () => {
    render(<PlannerUnlock slug="abc123" title="" />);

    expect(screen.getByText(/Untitled build/)).toBeTruthy();
});

test('the token field is a password input so it is not shoulder-surfed', () => {
    render(<PlannerUnlock slug="abc123" title="My Build" />);

    expect(
        screen
            .getByPlaceholderText('Paste your edit token…')
            .getAttribute('type'),
    ).toBe('password');
});
