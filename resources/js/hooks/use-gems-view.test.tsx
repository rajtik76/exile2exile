import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

// The hook keeps the view in module state, so re-import per case for a clean slate.
async function importHook() {
    return (await import('@/hooks/use-gems-view')).useGemsView;
}

beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
});

test('server render uses the default view even when another one is stored', async () => {
    window.localStorage.setItem('planner-gems-view', 'list');
    const useGemsView = await importHook();

    function Probe() {
        return <span>{useGemsView()[0]}</span>;
    }

    expect(renderToString(<Probe />)).toContain('grid');
});

test('client render reads the stored view', async () => {
    window.localStorage.setItem('planner-gems-view', 'list');
    const useGemsView = await importHook();

    const { result } = renderHook(() => useGemsView());

    expect(result.current[0]).toBe('list');
});

test('setting the view updates every consumer and persists it', async () => {
    const useGemsView = await importHook();
    const first = renderHook(() => useGemsView());
    const second = renderHook(() => useGemsView());

    act(() => first.result.current[1]('list'));

    expect(first.result.current[0]).toBe('list');
    expect(second.result.current[0]).toBe('list');
    expect(window.localStorage.getItem('planner-gems-view')).toBe('list');
});
