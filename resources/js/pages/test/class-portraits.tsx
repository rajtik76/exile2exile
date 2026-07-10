import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    ClassPortrait,
    classPortrait,
    classPortraitCatalog,
} from '@/components/build/classPortrait';

/**
 * Test-only harness (route registered only in local/testing). Renders every
 * resolvable class/ascendancy portrait and exposes classPortrait() on window so
 * the browser snapshot test can assert each frame maps correctly. Not part of
 * the product UI.
 */
export default function ClassPortraits() {
    const catalog = classPortraitCatalog();
    // Preload every portrait before rendering the grid, so the visual snapshot
    // is captured with all images decoded (otherwise it flakes under parallel
    // load). The grid - and thus the captions the test waits for - appears only
    // once they're ready.
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (window as unknown as Record<string, unknown>).__portrait =
            classPortrait;

        const urls = [
            ...new Set(
                catalog
                    .map(
                        ({ className, ascendancy }) =>
                            classPortrait(className, ascendancy)?.src,
                    )
                    .filter((src): src is string => Boolean(src)),
            ),
        ];
        let done = 0;
        const tick = () => {
            done += 1;

            if (done >= urls.length) {
                setReady(true);
            }
        };

        for (const url of urls) {
            const img = new Image();
            img.onload = tick;
            img.onerror = tick;
            img.src = url;
        }
    }, [catalog]);

    if (!ready) {
        return <Head title="Class portraits (test)" />;
    }

    return (
        <>
            <Head title="Class portraits (test)" />
            <div className="grid grid-cols-2 gap-4 bg-[#05080a] p-6 sm:grid-cols-4 lg:grid-cols-6">
                {catalog.map(({ className, ascendancy }) => (
                    <figure
                        key={`${className}:${ascendancy ?? 'base'}`}
                        data-portrait={`${className}:${ascendancy ?? 'base'}`}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="overflow-hidden rounded-md ring-1 ring-[#26403a]">
                            <ClassPortrait
                                className={className}
                                ascendancy={ascendancy}
                                size={120}
                            />
                        </div>
                        <figcaption className="text-center text-xs text-[#9fb4af] capitalize">
                            {className}
                            {ascendancy ? ` - ${ascendancy}` : ' (base)'}
                        </figcaption>
                    </figure>
                ))}
            </div>
        </>
    );
}
