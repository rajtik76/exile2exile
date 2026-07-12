import type { AscendancyDef, ClassDef } from '@poe2-toolkit/tree-core';
import { useEffect, useRef, useState } from 'react';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';
import TreeSharePanel from '@/components/passive-tree/TreeSharePanel';
import { ClearGlyph, Divider, INPUT_FONT, PANEL_FONT, PLAQUE } from './chrome';

/**
 * The planner's control bar, sitting above the tree on the /tree page: the
 * class and ascendancy pickers, the Path of Building importer and the save
 * action. Lifted out of {@link PassiveTreeView} so the canvas component carries
 * only what's bound to it (zoom, search, the point gauge); this is the build
 * chrome the page owns.
 *
 * In `edit` mode (the editor of a saved tree) the importer is dropped - the
 * build already exists, so there is nothing to import into it - and the bar
 * instead carries Save changes plus the link panel with the public/edit URLs,
 * the edit token and the delete flow.
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
    mode,
    code,
    onCode,
    onLoad,
    loading,
    error,
    canSave,
    dirty,
    onSave,
    saving,
    saved,
    saveError,
    slug,
    editToken,
    panelOpen,
    onTogglePanel,
    onClosePanel,
}: {
    classes: ClassDef[];
    activeClassId: number | null;
    onSelectClass: (id: number) => void;
    ascendancies: AscendancyDef[];
    activeAscendancy: string | null;
    onSelectAscendancy: (id: string | null) => void;
    locked: boolean;
    mode: 'create' | 'edit';
    code: string;
    onCode: (value: string) => void;
    onLoad: () => void;
    loading: boolean;
    error: string | null;
    canSave: boolean;
    dirty: boolean;
    onSave: () => void;
    saving: boolean;
    saved: boolean;
    saveError: string | null;
    slug: string | null;
    editToken: string | null;
    panelOpen: boolean;
    onTogglePanel: () => void;
    onClosePanel: () => void;
}) {
    // `relative z-20` gives the bar its own stacking context above the tree
    // canvas below, so an open dropdown (or the link panel) overhangs the tree
    // instead of being painted over by it.
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
            {mode === 'create' ? (
                <BuildImporter
                    code={code}
                    onCode={onCode}
                    onLoad={onLoad}
                    loading={loading}
                    error={error}
                    canSave={canSave}
                    onSave={onSave}
                    saving={saving}
                    saveError={saveError}
                />
            ) : (
                <EditorActions
                    canSave={canSave}
                    dirty={dirty}
                    onSave={onSave}
                    saving={saving}
                    saved={saved}
                    saveError={saveError}
                    panelOpen={panelOpen}
                    onTogglePanel={onTogglePanel}
                />
            )}

            {mode === 'edit' && panelOpen && slug && editToken && (
                <TreeSharePanel
                    slug={slug}
                    editToken={editToken}
                    onClose={onClosePanel}
                />
            )}
        </div>
    );
}

/**
 * The saved-tree editor's action plaque: the link panel toggle and Save changes.
 * Save is disabled while the tree matches its saved copy, and reads out the
 * in-flight and just-saved states so the author always knows where they stand.
 */
function EditorActions({
    canSave,
    dirty,
    onSave,
    saving,
    saved,
    saveError,
    panelOpen,
    onTogglePanel,
}: {
    canSave: boolean;
    dirty: boolean;
    onSave: () => void;
    saving: boolean;
    saved: boolean;
    saveError: string | null;
    panelOpen: boolean;
    onTogglePanel: () => void;
}) {
    return (
        <div className="ml-auto flex items-center">
            <div
                className={`flex h-full items-center gap-1 px-1 py-1 ${PLAQUE}`}
            >
                <button
                    type="button"
                    onClick={onTogglePanel}
                    aria-expanded={panelOpen}
                    title="Public link, edit link and token"
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#b39a64] uppercase transition-colors hover:bg-[#f0c869]/12 hover:text-[#ecc878] focus-visible:bg-[#f0c869]/12 focus-visible:text-[#ecc878] focus-visible:outline-none"
                >
                    Links
                </button>
                <Divider />
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !canSave || (!dirty && !saveError)}
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                >
                    {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
                </button>
            </div>

            {saveError && (
                <p className="absolute top-full right-3.5 z-30 mt-1 rounded-full bg-[#1a0c0c]/80 px-3 py-1 text-xs text-[#e07a7a]">
                    {saveError}
                </p>
            )}
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
 * to fill the rest of the bar. Save & share persists the tree - the server
 * answers by redirecting into the edit page with the fresh public link, edit
 * link and token in its panel.
 */
function BuildImporter({
    code,
    onCode,
    onLoad,
    loading,
    error,
    canSave,
    onSave,
    saving,
    saveError,
}: {
    code: string;
    onCode: (value: string) => void;
    onLoad: () => void;
    loading: boolean;
    error: string | null;
    canSave: boolean;
    onSave: () => void;
    saving: boolean;
    saveError: string | null;
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
                    onClick={onSave}
                    disabled={!canSave || saving}
                    title="Save this tree and get its public link and edit token"
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:text-[#ffdf9a] focus-visible:outline-none disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                >
                    {saving ? 'Saving…' : 'Save & share'}
                </button>
            </div>

            {error && (
                <p className="absolute top-full left-3.5 mt-1 rounded-full bg-[#1a0c0c]/80 px-3 py-1 text-xs text-[#e07a7a]">
                    {error}
                </p>
            )}

            {saveError && !error && (
                <p className="absolute top-full right-3.5 mt-1 rounded-full bg-[#1a0c0c]/80 px-3 py-1 text-xs text-[#e07a7a]">
                    {saveError}
                </p>
            )}
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
