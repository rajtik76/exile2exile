import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ReleaseCountdown, {
    ANNOUNCED_AT,
    LAUNCH_AT,
    journeyProgress,
    splitRemaining,
} from '@/components/release-countdown';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

test('splits remaining time into days, hours, minutes and seconds', () => {
    const milliseconds = ((3 * 24 + 4) * 60 * 60 + 5 * 60 + 6) * 1000 + 999;

    expect(splitRemaining(milliseconds)).toEqual({
        days: 3,
        hours: 4,
        minutes: 5,
        seconds: 6,
    });
    expect(splitRemaining(-5000)).toEqual({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });
});

test('clamps journey progress between announcement and launch', () => {
    expect(journeyProgress(ANNOUNCED_AT - 1)).toBe(0);
    expect(journeyProgress((ANNOUNCED_AT + LAUNCH_AT) / 2)).toBe(0.5);
    expect(journeyProgress(LAUNCH_AT + 1)).toBe(1);
});

test('ticks down every second until launch', () => {
    vi.setSystemTime(LAUNCH_AT - (2 * 60 * 60 + 61) * 1000);
    render(<ReleaseCountdown />);

    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
        '0 days, 2 hours, 1 minutes until launch',
    );

    for (let tick = 0; tick < 2; tick++) {
        act(() => {
            vi.advanceTimersByTime(1000);
        });
    }

    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
        '0 days, 2 hours, 0 minutes until launch',
    );
});

test('switches to the launched state once the countdown ends', () => {
    vi.setSystemTime(LAUNCH_AT - 1000);
    render(<ReleaseCountdown />);

    act(() => {
        vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('timer')).toBeNull();
    screen.getByText('Wraeclast is open');
});

test('lists what is new in 1.0 while counting down', () => {
    vi.setSystemTime(LAUNCH_AT - 1000);
    render(<ReleaseCountdown />);

    screen.getByText('What is new in 1.0');
    screen.getByText('Acts 5 and 6');
    screen.getByText('The Shadow');
    screen.getByText('Conquerors of Rayclast');
});

test('exposes the launch date as text and machine-readable time', () => {
    vi.setSystemTime(LAUNCH_AT - 1000);
    const { container } = render(<ReleaseCountdown />);

    const date = container.querySelector('time');

    expect(date?.getAttribute('datetime')).toBe('2026-12-11');
    expect(date?.textContent).toBe('December 11, 2026');
});
