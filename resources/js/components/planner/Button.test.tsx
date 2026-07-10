import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import Button, { SegmentedControl } from '@/components/planner/Button';

test('Button applies the variant class and defaults to type=button', () => {
    render(<Button variant="primary">Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-[var(--pl-accent)]');
});

test('an active Button shows the selected state, not the variant', () => {
    render(
        <Button variant="ghost" active>
            Act I
        </Button>,
    );

    expect(screen.getByRole('button').className).toContain(
        'bg-[var(--pl-accent-soft)]',
    );
});

test('SegmentedControl lights the active option and reports changes', () => {
    const onChange = vi.fn();

    render(
        <SegmentedControl
            value="phases"
            onChange={onChange}
            options={[
                { value: 'phases', label: 'Phases' },
                { value: 'single', label: 'No tabs' },
            ]}
        />,
    );

    expect(screen.getByRole('button', { name: 'Phases' }).className).toContain(
        'text-[var(--pl-accent-lit)]',
    );

    fireEvent.click(screen.getByRole('button', { name: 'No tabs' }));
    expect(onChange).toHaveBeenCalledWith('single');
});
