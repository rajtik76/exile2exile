import { useState } from 'react';
import Button, { SegmentedControl } from '@/components/planner/Button';
import FilterPreview from '@/components/planner/FilterPreview';
import { Panel } from '@/components/planner/ui/Panel';

export type FilterThemePayload = {
    value: string;
    label: string;
    swatch: string;
};

export type StrictnessPayload = {
    value: string;
    label: string;
    level: number;
};

// NeverSink ships seven strictness levels, 0 (soft) through 6 (uber-plus).
const STRICTNESS_STEPS = 7;

/**
 * Downloads an in-game loot filter for this build: the build-aware overlay (bases and mods
 * the build wants) on top of the economy value layer. The player picks a colour theme and
 * how strict to be, then downloads the `.filter` file (named after the build, phase, theme
 * and strictness by the server).
 */
export default function FilterPanel({
    themes,
    strictness,
    buildSlug,
    phase,
    className,
}: {
    themes: FilterThemePayload[];
    strictness: StrictnessPayload[];
    buildSlug: string;
    phase?: string | null;
    className?: string;
}) {
    const [theme, setTheme] = useState(themes[0]?.value ?? 'default');
    const [level, setLevel] = useState(strictness[1]?.value ?? '1-regular');

    const activeTheme =
        themes.find((item) => item.value === theme) ?? themes[0];
    const activeLevel =
        strictness.find((item) => item.value === level) ?? strictness[0];

    if (!activeTheme || !activeLevel) {
        return null;
    }

    const downloadUrl =
        `/filter/build/${buildSlug}?theme=${activeTheme.value}&strictness=${activeLevel.value}` +
        (phase ? `&phase=${encodeURIComponent(phase)}` : '');

    return (
        <Panel title="Loot filter" collapsible className={className}>
            <div className="flex flex-col gap-4">
                <p className="pl-text-sm text-[var(--pl-muted)]">
                    Download an in-game loot filter that highlights valuable
                    currency and uniques, tiered by live prices, plus the bases
                    and modifiers your build wants. Pick a colour theme and how
                    strict to be.
                </p>

                {/* Theme picker */}
                <div className="flex flex-col gap-1.5">
                    <span className="pl-text-2xs font-semibold tracking-[0.12em] text-[var(--pl-faint)] uppercase">
                        Theme
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {themes.map((item) => (
                            <Button
                                key={item.value}
                                size="sm"
                                active={item.value === theme}
                                onClick={() => setTheme(item.value)}
                            >
                                <span
                                    className="size-3 rounded-full ring-1 ring-black/40"
                                    style={{ background: item.swatch }}
                                />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Strictness picker */}
                <div className="flex flex-col gap-1.5">
                    <span className="pl-text-2xs font-semibold tracking-[0.12em] text-[var(--pl-faint)] uppercase">
                        Strictness
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                        <SegmentedControl
                            value={level}
                            onChange={setLevel}
                            options={strictness.map((item) => ({
                                value: item.value,
                                label: item.label,
                                title: `NeverSink ${item.label}`,
                            }))}
                        />
                        {/* NeverSink strictness scale: filled dots for how much clutter this
                        level hides (soft = 1, uber-plus = 7). Value highlights are unaffected. */}
                        <span
                            className="flex items-center gap-1"
                            title={`NeverSink level ${activeLevel.level} of 6`}
                        >
                            {Array.from(
                                { length: STRICTNESS_STEPS },
                                (_, index) => (
                                    <span
                                        key={index}
                                        className={`size-1.5 rounded-full ${
                                            index <= activeLevel.level
                                                ? 'bg-[var(--pl-accent)]'
                                                : 'bg-[var(--pl-panel-border)]'
                                        }`}
                                    />
                                ),
                            )}
                        </span>
                    </div>
                </div>

                {/* Live preview: real labels from the chosen NeverSink theme and strictness. */}
                <div className="flex flex-col gap-1.5">
                    <span className="pl-text-2xs font-semibold tracking-[0.12em] text-[var(--pl-faint)] uppercase">
                        Preview
                    </span>
                    <FilterPreview
                        theme={activeTheme.value}
                        strictness={activeLevel.value}
                    />
                </div>

                {/* Download the real .filter */}
                <div className="flex justify-end">
                    <a
                        href={downloadUrl}
                        download
                        className="pl-text-sm inline-flex items-center justify-center gap-1.5 rounded-[var(--pl-radius)] border-2 border-[var(--pl-accent)] bg-[var(--pl-accent)] px-4 py-2 font-medium text-[#15120b] transition outline-none hover:border-[var(--pl-accent-lit)] hover:bg-[var(--pl-accent-lit)] focus-visible:ring-2 focus-visible:ring-[var(--pl-ring)]"
                    >
                        Download filter
                    </a>
                </div>
            </div>
        </Panel>
    );
}
