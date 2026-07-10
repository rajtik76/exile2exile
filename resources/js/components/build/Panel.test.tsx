import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Panel } from '@/components/build/Panel';

test('a plain panel shows its body and has no collapse toggle', () => {
    render(<Panel title="Items">body content</Panel>);

    expect(screen.getByText('body content')).toBeTruthy();
    expect(screen.queryByTitle('Hide panel')).toBeNull();
});

test('a collapsible panel hides and shows its body from the header toggle', () => {
    render(
        <Panel title="Items" collapsible>
            body content
        </Panel>,
    );

    // Open by default: body shown, toggle offers to hide.
    expect(screen.getByText('body content')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Hide panel'));

    // Collapsed: body gone, toggle now offers to show.
    expect(screen.queryByText('body content')).toBeNull();
    fireEvent.click(screen.getByTitle('Show panel'));

    expect(screen.getByText('body content')).toBeTruthy();
});

test('a collapsible panel can start collapsed', () => {
    render(
        <Panel title="Items" collapsible defaultCollapsed>
            body content
        </Panel>,
    );

    expect(screen.queryByText('body content')).toBeNull();
    expect(screen.getByTitle('Show panel')).toBeTruthy();
});
