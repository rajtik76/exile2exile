import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import UniqueModRow from '@/components/planner/equipment/UniqueModRow';
import type { UniqueModLine } from '@/lib/planReferences';

const line: UniqueModLine = {
    key: '+# to maximum Life',
    template: '+(80-120) to maximum Life',
    rolls: [{ min: 80, max: 120 }],
};

test('typing a value does not commit until the field loses focus', () => {
    const onChange = vi.fn();

    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '9' } });
    expect(input.value).toBe('9');
    expect(onChange).not.toHaveBeenCalled();
});

test('an out-of-range value is never committed and refuses to let focus leave', () => {
    const onChange = vi.fn();

    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);

    // Still shows exactly what was typed - never silently rewritten to a valid value.
    expect(input.value).toBe('9');
    expect(onChange).not.toHaveBeenCalled();
    // Refocused synchronously within the blur handler itself - no deferred timeout, so
    // no visible flicker of focus landing elsewhere before snapping back.
    expect(document.activeElement).toBe(input);
});

test('Tab is intercepted outright while invalid - focus never even starts to leave', () => {
    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={vi.fn()}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: '9' } });

    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
});

test('Tab moves on normally once the value is valid', () => {
    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={vi.fn()}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: '110' } });

    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
});

test('an out-of-range value marks the field invalid, live as it is typed', () => {
    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={vi.fn()}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    expect(input.getAttribute('aria-invalid')).toBe('false');

    fireEvent.change(input, { target: { value: '9' } });

    expect(input.getAttribute('aria-invalid')).toBe('true');
});

test('a value within range is committed unclamped and marked valid', () => {
    const onChange = vi.fn();

    render(
        <UniqueModRow
            line={line}
            values={[80]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '110' } });
    expect(input.getAttribute('aria-invalid')).toBe('false');

    fireEvent.blur(input);

    expect(input.value).toBe('110');
    expect(onChange).toHaveBeenCalledWith([110]);
});

test('pressing Enter commits the value the same way blur does', () => {
    const onChange = vi.fn();

    render(
        <UniqueModRow
            line={line}
            values={[80]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    // blur() is a no-op on an element that isn't the active one, so it must be focused
    // first (the real DOM method - fireEvent.focus only dispatches the event, it doesn't
    // update document.activeElement) - same as it would be once a user clicks into it.
    input.focus();
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([100]);
});

test('an unparseable value is never committed and also traps focus', () => {
    const onChange = vi.fn();

    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 80-120') as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
});

test('a decimal value within range is kept exactly as typed', () => {
    const onChange = vi.fn();
    const decimalLine: UniqueModLine = {
        key: '# Life Regeneration per second',
        template: '(8-12) Life Regeneration per second',
        rolls: [{ min: 8, max: 12 }],
    };

    render(
        <UniqueModRow
            line={decimalLine}
            values={[8]}
            onChange={onChange}
            onValidityChange={vi.fn()}
        />,
    );

    const input = screen.getByTitle('Valid range: 8-12') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '11.9' } });
    fireEvent.blur(input);

    expect(input.value).toBe('11.9');
    expect(onChange).toHaveBeenCalledWith([11.9]);
});

test('the allowed range is always visible next to the field, not just on hover', () => {
    render(
        <UniqueModRow
            line={line}
            values={[100]}
            onChange={vi.fn()}
            onValidityChange={vi.fn()}
        />,
    );

    expect(screen.getByText('80–120')).toBeTruthy();
});

test('a flavour-text line with no rolls renders as plain text, no input', () => {
    const flavour: UniqueModLine = {
        key: 'Unwavering Stance',
        template: 'Unwavering Stance',
        rolls: [],
    };

    render(
        <UniqueModRow
            line={flavour}
            values={[]}
            onChange={vi.fn()}
            onValidityChange={vi.fn()}
        />,
    );

    expect(screen.getByText('Unwavering Stance')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
});
