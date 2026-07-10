import type { AscendancyDef, ClassDef } from '@poe2-toolkit/tree-core';
import { useEffect, useRef, useState } from 'react';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';
import { ClearGlyph, Divider, INPUT_FONT, PANEL_FONT, PLAQUE } from './chrome';

/**
 * The planner's control bar, sitting above the tree on the /tree page: the
 * class and ascendancy pickers and the Path of Building importer. Lifted out of
 * {@link PassiveTreeView} so the canvas component carries only what's bound to
 * it (zoom, search, the point gauge); this is the build chrome the page owns.
 *
 * The page hides the whole bar while the tree is fullscreen, so the pickers and
 * importer are a windowed-only affordance.
 */
export function PlannerControls({
    classes,
    activeClassId,
    onSelectClass,
    ascendancies,
    activeAscendancy,
    onSelectAscendancy,
    locked,
    code,
    onCode,
    onLoad,
    loading,
    error,
    canShare,
    onShare,
    onCloseShare,
    sharing,
    shareUrl,
    shareError,
}: {
    classes: ClassDef[];
    activeClassId: number | null;
    onSelectClass: (id: number) => void;
    ascendancies: AscendancyDef[];
    activeAscendancy: string | null;
    onSelectAscendancy: (id: string | null) => void;
    locked: boolean;
    code: string;
    onCode: (value: string) => void;
    onLoad: () => void;
    loading: boolean;
    error: string | null;
    canShare: boolean;
    onShare: () => void;
    onCloseShare: () => void;
    sharing: boolean;
    shareUrl: string | null;
    shareError: string | null;
}) {
    // `relative z-20` gives the bar its own stacking context above the tree
    // canvas below, so an open dropdown overhangs the tree instead of being
    // painted over by it.
    return (
        <div
            className="relative z-20 flex w-full flex-wrap items-stretch gap-3 border-b border-[#40331a] bg-[#1e1409] px-3 py-3 sm:gap-4 sm:px-6 sm:py-4"
            style={PANEL_FONT}
        >
            <PlannerPanel
                classes={classes}
                activeClassId={activeClassId}
                onSelectClass={onSelectClass}
                ascendancies={ascendancies}
                activeAscendancy={activeAscendancy}
                onSelectAscendancy={onSelectAscendancy}
                locked={locked}
            />
            <BuildImporter
                code={code}
                onCode={onCode}
                onLoad={onLoad}
                loading={loading}
                error={error}
                canShare={canShare}
                onShare={onShare}
                onCloseShare={onCloseShare}
                sharing={sharing}
                shareUrl={shareUrl}
                shareError={shareError}
            />
        </div>
    );
}

/** The planner panel: class + ascendancy pickers in a row. */
const SIGIL_BAR = `flex items-center gap-0.5 ${PLAQUE}`;

/** An interactive picker segment inside the sigil-bar. */
const SEGMENT =
    'group flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-left transition-colors hover:bg-[#f0c869]/8 focus-visible:bg-[#f0c869]/10 focus-visible:outline-none';

/** Locked segment: reads out the import's choice, no hover, can't open. */
const SEGMENT_LOCKED =
    'flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-left opacity-90';

/**
 * The build importer: paste a PoB code or pobb.in link to read its allocation
 * in. It wears the same bronze {@link PLAQUE} shell as the pickers and stretches
 * to fill the rest of the bar.
 */
function BuildImporter({
    code,
    onCode,
    onLoad,
    loading,
    error,
    canShare,
    onShare,
    onCloseShare,
    sharing,
    shareUrl,
    shareError,
}: {
    code: string;
    onCode: (value: string) => void;
    onLoad: () => void;
    loading: boolean;
    error: string | null;
    canShare: boolean;
    onShare: () => void;
    onCloseShare: () => void;
    sharing: boolean;
    shareUrl: string | null;
    shareError: string | null;
}) {
    return (
        <div className="relative w-full md:w-auto md:min-w-0 md:flex-1">
            <div
                className={`flex h-full items-center gap-1 py-1 pr-1 pl-3.5 transition-colors focus-within:border-[#a9842f] ${PLAQUE}`}
            >
                <LinkGlyph />
                <input
                    value={code}
                    onChange={(event) => onCode(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            onLoad();
                        }
                    }}
                    placeholder="Paste a Path of Building 2 code or pobb.in link…"
                    spellCheck={false}
                    // The SmallCaps bar font reads poorly white and small, so the
                    // typed code uses plain Fontin at a larger size; the placeholder
                    // keeps the bar's tooltip face (overridden back via ::placeholder).
                    style={INPUT_FONT}
                    className="h-full min-w-0 flex-1 bg-transparent text-base font-medium tracking-wide text-[#f5ecd8] outline-none placeholder:[font-family:'Fontin_SmallCaps',_'Cinzel',_serif] placeholder:text-sm placeholder:text-[#8a7850]"
                />
                {code !== '' && (
                    <button
                        type="button"
                        onClick={() => onCode('')}
                        title="Clear input"
                        aria-label="Clear input"
                        className="grid size-5 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none"
                    >
                        <ClearGlyph />
                    </button>
                )}
                <Divider />
                <button
                    type="button"
                    onClick={onLoad}
                    disabled={loading || code.trim() === ''}
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                >
                    {loading ? 'Reading…' : 'Load build'}
                </button>
                <Divider />
                <button
                    type="button"
                    onClick={onShare}
                    disabled={!canShare || sharing}
                    title="Create a shareable link to this tree"
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                >
                    {sharing ? 'Sharing…' : 'Share'}
                </button>
            </div>

            {error && (
                <p className="absolute top-full left-3.5 mt-1 rounded-full bg-[#1a0c0c]/80 px-3 py-1 text-xs text-[#e07a7a]">
                    {error}
                </p>
            )}

            {shareError && !error && (
                <p className="absolute top-full right-3.5 mt-1 rounded-full bg-[#1a0c0c]/80 px-3 py-1 text-xs text-[#e07a7a]">
                    {shareError}
                </p>
            )}

            {shareUrl && !shareError && (
                <ShareLink url={shareUrl} onClose={onCloseShare} />
            )}
        </div>
    );
}

/**
 * The freshly minted share URL with a one-click copy. Sits under the importer
 * once a share succeeds; copying falls back to selecting the field where the
 * clipboard API is unavailable (insecure origins).
 */
function ShareLink({ url, onClose }: { url: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Escape closes the read-out, matching the dropdowns' dismiss key.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const copy = () => {
        inputRef.current?.select();
        navigator.clipboard?.writeText(url).then(
            () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            },
            () => {},
        );
    };

    return (
        <div
            className={`absolute top-full right-0 left-0 z-30 mt-2 flex items-center gap-1 py-1 pr-1 pl-3.5 ${PLAQUE}`}
        >
            <span className="shrink-0 text-[10px] font-semibold tracking-[0.16em] text-[#8a7850] uppercase">
                Link
            </span>
            <input
                ref={inputRef}
                value={url}
                readOnly
                onFocus={(event) => event.target.select()}
                // Plain Fontin like the import field - a URL must read literally,
                // not in the bar's SmallCaps.
                style={INPUT_FONT}
                className="h-full min-w-0 flex-1 bg-transparent text-base font-medium tracking-wide text-[#f5ecd8] outline-none"
            />
            <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none"
            >
                {copied ? 'Copied' : 'Copy'}
            </button>
            <Divider />
            <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close share link"
                className="grid size-7 shrink-0 place-items-center rounded-full text-[#8a7850] transition-colors hover:bg-[#f0c869]/10 hover:text-[#ecc878] focus-visible:text-[#ecc878] focus-visible:outline-none"
            >
                <ClearGlyph />
            </button>
        </div>
    );
}

/**
 * The class and ascendancy pickers in one engraved bar. When `locked` (a build
 * has been imported), both pickers freeze - the import fixes the class and
 * ascendancy, so they read out but no longer open.
 */
function PlannerPanel({
    classes,
    activeClassId,
    onSelectClass,
    ascendancies,
    activeAscendancy,
    onSelectAscendancy,
    locked,
}: {
    classes: ClassDef[];
    activeClassId: number | null;
    onSelectClass: (id: number) => void;
    ascendancies: AscendancyDef[];
    activeAscendancy: string | null;
    onSelectAscendancy: (id: string | null) => void;
    locked: boolean;
}) {
    const activeClass = classes.find((cls) => cls.id === activeClassId);
    const showAscendancy = ascendancies.length > 0 && activeClass;

    return (
        <div className="shrink-0">
            <div className={SIGIL_BAR}>
                {classes.length > 0 && (
                    <ClassDropdown
                        classes={classes}
                        activeClassId={activeClassId}
                        onSelect={onSelectClass}
                        locked={locked}
                    />
                )}

                {showAscendancy && (
                    <>
                        <Divider />
                        <AscendancyDropdown
                            className={activeClass.name}
                            ascendancies={ascendancies}
                            active={activeAscendancy}
                            onSelect={onSelectAscendancy}
                            locked={locked}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

/** A circular class/ascendancy medallion in a gold ring. */
function Medallion({
    className,
    ascendancy = null,
    size = 30,
}: {
    className: string;
    ascendancy?: string | null;
    size?: number;
}) {
    const has = classPortrait(className, ascendancy) !== null;

    return (
        <span
            className="grid shrink-0 place-items-center overflow-hidden rounded-full"
            style={{
                width: size,
                height: size,
                background:
                    'radial-gradient(circle at 50% 30%, #2a1d0c, #0b0805 80%)',
                boxShadow: 'inset 0 0 0 1.5px rgba(199,154,63,0.55)',
            }}
        >
            {has ? (
                <ClassPortrait
                    className={className}
                    ascendancy={ascendancy}
                    size={size}
                />
            ) : (
                <span className="text-[11px] text-[#e6d2a0]">
                    {className.charAt(0).toUpperCase()}
                </span>
            )}
        </span>
    );
}

/** Class picker: a medallion + name trigger over a portrait-led option list. */
function ClassDropdown({
    classes,
    activeClassId,
    onSelect,
    locked = false,
}: {
    classes: ClassDef[];
    activeClassId: number | null;
    onSelect: (id: number) => void;
    locked?: boolean;
}) {
    const active = classes.find((cls) => cls.id === activeClassId);
    const name = active?.name ?? (locked ? '?' : 'Choose a class');

    if (locked) {
        return (
            <span
                className={SEGMENT_LOCKED}
                title="Locked by the imported build"
            >
                <Medallion className={active?.name ?? '?'} size={26} />
                <span className="text-sm font-semibold text-[#f5ecd8]">
                    {name}
                </span>
                <LockGlyph />
            </span>
        );
    }

    return (
        <Dropdown
            label="Class"
            trigger={
                <span className={SEGMENT}>
                    <Medallion className={active?.name ?? '?'} size={26} />
                    <span className="text-sm font-semibold text-[#f5ecd8]">
                        {name}
                    </span>
                    <Chevron />
                </span>
            }
        >
            {(close) =>
                classes.map((cls) => (
                    <DropdownItem
                        key={cls.id}
                        active={cls.id === activeClassId}
                        onClick={() => {
                            onSelect(cls.id);
                            close();
                        }}
                    >
                        <Medallion className={cls.name} size={26} />
                        <span className="text-sm font-semibold text-[#e6d2a0]">
                            {cls.name}
                        </span>
                    </DropdownItem>
                ))
            }
        </Dropdown>
    );
}

/** Ascendancy picker for the active class; first option clears the choice. */
function AscendancyDropdown({
    className,
    ascendancies,
    active,
    onSelect,
    locked = false,
}: {
    className: string;
    ascendancies: AscendancyDef[];
    active: string | null;
    onSelect: (id: string | null) => void;
    locked?: boolean;
}) {
    const current = ascendancies.find((asc) => asc.id === active);

    if (locked) {
        return (
            <span
                className={SEGMENT_LOCKED}
                title="Locked by the imported build"
            >
                <Medallion
                    className={className}
                    ascendancy={current?.name ?? null}
                    size={24}
                />
                <span className="text-sm font-medium text-[#f5ecd8]">
                    {current?.name ?? 'No ascendancy'}
                </span>
                <LockGlyph />
            </span>
        );
    }

    return (
        <Dropdown
            label="Ascendancy"
            trigger={
                <span className={SEGMENT}>
                    <Medallion
                        className={className}
                        ascendancy={current?.name ?? null}
                        size={24}
                    />
                    <span className="text-sm font-medium text-[#f5ecd8]">
                        {current?.name ?? 'No ascendancy'}
                    </span>
                    <Chevron />
                </span>
            }
        >
            {(close) => (
                <>
                    <DropdownItem
                        active={active === null}
                        onClick={() => {
                            onSelect(null);
                            close();
                        }}
                    >
                        <span className="grid size-[26px] place-items-center rounded-full border border-[#5a4626] text-[#8a7850]">
                            ✕
                        </span>
                        <span className="text-[#b39a64]">No ascendancy</span>
                    </DropdownItem>
                    {ascendancies.map((asc) => (
                        <DropdownItem
                            key={asc.id}
                            active={asc.id === active}
                            onClick={() => {
                                onSelect(asc.id);
                                close();
                            }}
                        >
                            <Medallion
                                className={className}
                                ascendancy={asc.name}
                                size={26}
                            />
                            <span className="text-sm font-semibold text-[#e6d2a0]">
                                {asc.name}
                            </span>
                        </DropdownItem>
                    ))}
                </>
            )}
        </Dropdown>
    );
}

/**
 * A small themed dropdown: a button trigger and an absolutely-positioned panel,
 * closed on outside-click or Escape.
 */
function Dropdown({
    label,
    trigger,
    children,
}: {
    label: string;
    trigger: React.ReactNode;
    children: (close: () => void) => React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onDown = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((on) => !on)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                className="block rounded-full focus-visible:ring-1 focus-visible:ring-[#f0c869]/45 focus-visible:outline-none"
            >
                {trigger}
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute top-full left-0 z-30 mt-1.5 max-h-72 min-w-[12rem] overflow-auto rounded-sm border border-[#6e5526] bg-[#0b0805] p-1 shadow-xl shadow-black/60"
                >
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

function DropdownItem({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="option"
            aria-selected={active}
            onClick={onClick}
            className={`flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none ${
                active
                    ? 'bg-[#f0c869]/12 text-[#ecc878]'
                    : 'text-[#cdb784] hover:bg-[#f0c869]/8 focus-visible:bg-[#f0c869]/8'
            }`}
        >
            {children}
        </button>
    );
}

function Chevron() {
    return (
        <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#8a7850] transition-colors group-hover:text-[#d8b766]"
            aria-hidden="true"
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

/** A small link glyph leading the import field - it accepts codes and links. */
function LinkGlyph() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[#8a7850]"
            aria-hidden="true"
        >
            <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
    );
}

/** Small padlock shown in place of the chevron when a picker is locked. */
function LockGlyph() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1 text-[#4f6b63]"
            aria-hidden="true"
        >
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
    );
}
