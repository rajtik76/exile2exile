import { useState } from 'react';
import { ClassPortrait } from '@/components/build/classPortrait';
import { Eyebrow, Heading } from '@/components/planner/ui/Text';
import { useTreeData } from '@/lib/useTreeData';
import type { PlanBuild } from '@/types/planner';

/**
 * The build's opening screen, in two steps: first pick one of the eight classes, then
 * pick that class's ascendancy (or skip it to start un-ascended). Selecting an
 * ascendancy sets both class and ascendancy; skipping sets the class alone. The choice
 * is locked afterwards (only "New build" reopens this), so it stands alone here rather
 * than as an always-editable control - the planner edit page is its only host.
 */
export default function BuildClassGallery({
    onPick,
}: {
    onPick: (build: PlanBuild) => void;
}) {
    const { data } = useTreeData();

    // Real PoE2 classes carry ascendancies; GGPK's PoE1 placeholder classes don't.
    const classes = data
        ? data.classes.filter((cls) => cls.ascendancies.length > 0)
        : [];

    // Which class's ascendancy row is open. Picking a class only reveals its
    // ascendancies - the build isn't chosen until an ascendancy (or "skip") is picked.
    const [openClass, setOpenClass] = useState<string | null>(null);
    const selected = classes.find((cls) => cls.name === openClass) ?? null;

    return (
        <section className="mx-auto max-w-4xl py-10 text-center">
            <Eyebrow className="flex justify-center">Build planner</Eyebrow>
            <Heading level={1} className="mt-2">
                Choose your class
            </Heading>
            <p className="pl-text-sm mt-1 text-[var(--pl-muted)]">
                Pick a class, then its ascendancy - or start without one. This
                is locked once set - use New build to change it.
            </p>

            {!data ? (
                <p className="pl-text-sm mt-12 text-[var(--pl-muted)]">
                    Loading classes…
                </p>
            ) : (
                <>
                    {/* Step one: the eight classes. */}
                    <div className="mt-10 flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
                        {classes.map((cls) => (
                            <PortraitTile
                                key={cls.id}
                                className={cls.name}
                                label={cls.name}
                                sublabel="Class"
                                active={cls.name === openClass}
                                onClick={() =>
                                    setOpenClass((current) =>
                                        current === cls.name ? null : cls.name,
                                    )
                                }
                            />
                        ))}
                    </div>

                    {/* Step two: the chosen class's ascendancies, plus a skip. */}
                    {selected && (
                        <div className="mt-10 border-t border-[var(--pl-divider)] pt-8">
                            <Eyebrow className="flex justify-center">
                                {selected.name} - choose ascendancy
                            </Eyebrow>
                            <div className="mt-6 flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
                                {selected.ascendancies.map((asc) => (
                                    <PortraitTile
                                        key={asc.id}
                                        className={selected.name}
                                        ascendancy={asc.name}
                                        label={asc.name}
                                        sublabel="Ascendancy"
                                        onClick={() =>
                                            onPick({
                                                className: selected.name,
                                                ascendId: asc.id,
                                            })
                                        }
                                    />
                                ))}
                                <NoAscendancyTile
                                    onClick={() =>
                                        onPick({
                                            className: selected.name,
                                            ascendId: null,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

/** One selectable portrait: the centre art, enlarging and glowing on hover, with
 *  the class/ascendancy name beneath it. `active` keeps it lit while its ascendancy
 *  row is open. */
function PortraitTile({
    className,
    ascendancy = null,
    label,
    sublabel,
    active = false,
    onClick,
}: {
    className: string;
    ascendancy?: string | null;
    label: string;
    sublabel: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={ascendancy ? `${className} - ${ascendancy}` : className}
            className="group flex w-24 flex-col items-center gap-2 outline-none"
        >
            <span
                className={`relative flex size-20 items-center justify-center overflow-hidden rounded-full border bg-[var(--pl-panel-2)] transition duration-200 group-hover:scale-110 group-hover:border-[var(--pl-accent)] group-hover:ring-2 group-hover:ring-[var(--pl-ring)] group-focus-visible:scale-110 group-focus-visible:border-[var(--pl-accent)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--pl-ring)] ${
                    active
                        ? 'scale-110 border-[var(--pl-accent)] ring-2 ring-[var(--pl-ring)]'
                        : 'border-[var(--pl-panel-border)]'
                }`}
            >
                <ClassPortrait
                    className={className}
                    ascendancy={ascendancy}
                    size={80}
                />
            </span>
            <span className="flex flex-col items-center leading-tight">
                <span
                    className={`pl-text-sm font-medium transition group-hover:text-[var(--pl-accent-lit)] ${
                        active
                            ? 'text-[var(--pl-accent-lit)]'
                            : 'text-[var(--pl-text-strong)]'
                    }`}
                >
                    {label}
                </span>
                <span className="pl-text-2xs text-[var(--pl-faint)]">
                    {sublabel}
                </span>
            </span>
        </button>
    );
}

/** The "skip ascendancy" choice: an empty dotted circle with its label centred, set
 *  apart from the real portraits so it reads as "none" rather than a class. */
function NoAscendancyTile({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="Start without an ascendancy"
            className="group flex w-24 flex-col items-center gap-2 outline-none"
        >
            <span className="relative flex size-20 items-center justify-center rounded-full border border-dashed border-[var(--pl-panel-border)] text-center transition duration-200 group-hover:scale-110 group-hover:border-[var(--pl-accent)] group-focus-visible:scale-110 group-focus-visible:border-[var(--pl-accent)]">
                <span className="pl-text-2xs px-2 leading-tight text-[var(--pl-muted)] transition group-hover:text-[var(--pl-accent-lit)] group-focus-visible:text-[var(--pl-accent-lit)]">
                    No ascendancy
                </span>
            </span>
        </button>
    );
}
