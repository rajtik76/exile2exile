import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, unsubscribe } = vi.hoisted(() => ({
    toast: { success: vi.fn(), error: vi.fn() },
    unsubscribe: vi.fn(),
}));
let flashHandler: ((event: unknown) => void) | null = null;

vi.mock('@inertiajs/react', () => ({
    router: {
        on: (event: string, handler: (event: unknown) => void) => {
            if (event === 'flash') {
                flashHandler = handler;
            }

            return unsubscribe;
        },
    },
}));
vi.mock('sonner', () => ({ toast }));

import { useFlashToast } from '@/hooks/use-flash-toast';

beforeEach(() => {
    vi.clearAllMocks();
    flashHandler = null;
});

describe('useFlashToast', () => {
    it('shows a toast of the flashed type and message', () => {
        renderHook(() => useFlashToast());

        flashHandler?.({
            detail: { flash: { toast: { type: 'success', message: 'Saved' } } },
        });

        expect(toast.success).toHaveBeenCalledWith('Saved');
    });

    it('does nothing when the flash carries no toast payload', () => {
        renderHook(() => useFlashToast());

        flashHandler?.({ detail: { flash: {} } });

        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useFlashToast());

        unmount();

        expect(unsubscribe).toHaveBeenCalled();
    });
});
