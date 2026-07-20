import { act, cleanup, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import LazyMount from '@/components/LazyMount';

/** A controllable IntersectionObserver stub: tests trigger intersection by hand. */
class FakeIntersectionObserver {
    static instances: FakeIntersectionObserver[] = [];

    disconnect = vi.fn();
    observe = vi.fn();

    constructor(private callback: IntersectionObserverCallback) {
        FakeIntersectionObserver.instances.push(this);
    }

    intersect(isIntersecting: boolean): void {
        this.callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
        );
    }
}

let originalIntersectionObserver: typeof IntersectionObserver | undefined;

beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
        FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
    globalThis.IntersectionObserver =
        originalIntersectionObserver as typeof IntersectionObserver;
});

test('shows the fallback until the wrapper nears the viewport', () => {
    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    expect(screen.getByText('Loading skeleton')).toBeTruthy();
    expect(screen.queryByText('Real content')).toBeNull();
});

test('mounts the children once the observer reports an intersection', () => {
    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    act(() => {
        FakeIntersectionObserver.instances[0]?.intersect(true);
    });

    expect(screen.getByText('Real content')).toBeTruthy();
    expect(screen.queryByText('Loading skeleton')).toBeNull();
});

test('disconnects the observer once mounted, so it never re-checks after scrolling away', () => {
    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    const observer = FakeIntersectionObserver.instances[0];
    act(() => {
        observer?.intersect(true);
    });

    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
});

test('ignores a non-intersecting report and stays on the fallback', () => {
    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    act(() => {
        FakeIntersectionObserver.instances[0]?.intersect(false);
    });

    expect(screen.getByText('Loading skeleton')).toBeTruthy();
    expect(screen.queryByText('Real content')).toBeNull();
});

test('unmounting before the observer ever reports an intersection disconnects cleanly', () => {
    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    const observer = FakeIntersectionObserver.instances[0];

    expect(() => cleanup()).not.toThrow();
    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
});

test('the server-rendered markup matches what the client hydrates onto it, no mismatch warning', () => {
    // The real SSR scenario the KRITICKÉ regression was about: render server-side
    // (Node has no IntersectionObserver) into a static HTML string, then hydrate
    // that exact markup on the client (where IntersectionObserver does exist).
    // A component that picks its initial state differently in each environment
    // makes React discard the server markup and log a hydration-mismatch error -
    // this test fails loudly if that regression ever comes back.
    const withoutIntersectionObserver = globalThis.IntersectionObserver;
    // @ts-expect-error - simulating the Node/SSR environment, which has no global.
    delete globalThis.IntersectionObserver;

    const element = (
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>
    );
    const serverHtml = renderToStaticMarkup(element);

    globalThis.IntersectionObserver = withoutIntersectionObserver;

    expect(serverHtml).toContain('Loading skeleton');
    expect(serverHtml).not.toContain('Real content');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

    act(() => {
        hydrateRoot(container, element);
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Loading skeleton');

    consoleError.mockRestore();
    container.remove();
});

test('mounts immediately when IntersectionObserver is unavailable', () => {
    globalThis.IntersectionObserver =
        undefined as unknown as typeof IntersectionObserver;

    render(
        <LazyMount fallback={<div>Loading skeleton</div>}>
            <div>Real content</div>
        </LazyMount>,
    );

    expect(screen.getByText('Real content')).toBeTruthy();
});
