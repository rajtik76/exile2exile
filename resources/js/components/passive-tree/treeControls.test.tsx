import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
    BudgetBar,
    ClearBuildButton,
    SearchBox,
    ZoomBar,
} from './treeControls';

test('SearchBox reports typing, submits on Enter and clears itself', function () {
    const onValue = vi.fn();
    const onSubmit = vi.fn();

    render(
        <SearchBox
            value="life"
            onValue={onValue}
            onSubmit={onSubmit}
            matchCount={2}
        />,
    );

    const input = screen.getByLabelText('Search passive nodes by name or stat');

    fireEvent.change(input, { target: { value: 'lifer' } });
    expect(onValue).toHaveBeenCalledWith('lifer');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // A non-Enter key never submits.
    fireEvent.keyDown(input, { key: 'a' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onValue).toHaveBeenCalledWith('');
});

test('SearchBox pluralises the match count and hides Clear when empty', function () {
    const { rerender } = render(
        <SearchBox
            value=""
            onValue={() => {}}
            onSubmit={() => {}}
            matchCount={1}
        />,
    );

    expect(screen.getByText('hit')).toBeTruthy();
    expect(screen.queryByLabelText('Clear search')).toBeNull();

    rerender(
        <SearchBox
            value="x"
            onValue={() => {}}
            onSubmit={() => {}}
            matchCount={3}
        />,
    );

    expect(screen.getByText('hits')).toBeTruthy();
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
});

test('BudgetBar picks the paint mode while editing', function () {
    const onMode = vi.fn();

    render(
        <BudgetBar
            mode={0}
            onMode={onMode}
            basic={12}
            basicLimit={123}
            weaponSets={{ setI: 3, setII: 0, limit: 24 }}
            ascendancy={{ used: 4, limit: 8 }}
        />,
    );

    const radios = screen.getAllByRole('radio');

    // Basic + set I + set II; the active segment is checked.
    expect(radios).toHaveLength(3);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');

    fireEvent.click(radios[1]);
    expect(onMode).toHaveBeenCalledWith(1);

    // Every budget reads out used/limit; ascendancy is a static count.
    expect(screen.getByText('12/123')).toBeTruthy();
    expect(screen.getByText('3/24')).toBeTruthy();
    expect(screen.getByText('4/8')).toBeTruthy();
    expect(screen.getByLabelText('Ascendancy points')).toBeTruthy();
});

test('BudgetBar reads out without buttons when read-only, hiding unused sections', function () {
    render(
        <BudgetBar
            mode={0}
            onMode={null}
            basic={40}
            basicLimit={123}
            weaponSets={null}
            ascendancy={null}
        />,
    );

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('40/123')).toBeTruthy();
    expect(screen.queryByLabelText('Ascendancy points')).toBeNull();
});

test('ClearBuildButton wipes the build on click', function () {
    const onClear = vi.fn();

    render(<ClearBuildButton onClear={onClear} />);
    fireEvent.click(screen.getByLabelText('Clear the whole build'));

    expect(onClear).toHaveBeenCalledTimes(1);
});

test('ZoomBar zooms and toggles fullscreen', function () {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onToggleFullscreen = vi.fn();

    const { rerender } = render(
        <ZoomBar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            fullscreen={false}
            onToggleFullscreen={onToggleFullscreen}
        />,
    );

    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Fullscreen'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

    rerender(
        <ZoomBar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            fullscreen
            onToggleFullscreen={onToggleFullscreen}
        />,
    );

    expect(screen.getByLabelText('Exit fullscreen')).toBeTruthy();
});
