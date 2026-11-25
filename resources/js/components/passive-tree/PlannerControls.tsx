import type { AscendancyDef, ClassDef } from '@poe2-toolkit/tree-core';
import { ChevronDown, Link2, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GameVersionBadge } from '@/components/build/GameVersion';
import TreeSharePanel from '@/components/passive-tree/TreeSharePanel';
import {
    BAR_GUTTER,
    ClearGlyph,
    FIELD_ERROR,
    FIELD_ICON_BUTTON,
    FIELD_INPUT,
    FIELD_SHELL,
    FOCUS_RING,
    ICON_STROKE,
    Medallion,
} from './chrome';

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
            className={`relative z-20 flex w-full flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line bg-stone-900 py-3 font-ui text-paper ${BAR_GUTTER}`}
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
            <GameVersionBadge className="order-first w-full" />
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
        <div className="ml-auto flex items-center gap-2">
            <button
                type="button"
                onClick={onTogglePanel}
                aria-expanded={panelOpen}
                title="Public link, edit link and token"
                className="btn btn-iron aria-expanded:border-ember-400 aria-expanded:text-ember-300"
            >
                Links
            </button>
            <button
                type="button"
                onClick={onSave}
                disabled={saving || !canSave || (!dirty && !saveError)}
                className="btn btn-copper"
            >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>

            {saveError && (
                <p
                    className={`${FIELD_ERROR} right-[6%] min-[821px]:right-[min(3.4%,76px)]`}
                >
                    {saveError}
                </p>
            )}
        </div>
    );
}

/** The joined shell of the class and ascendancy pickers. */
const PICKER_SHELL =
    'flex h-9 items-stretch rounded-[2px] border border-line bg-void';

/** An interactive picker segment inside the shell. */
const SEGMENT =
    'group flex h-full items-center gap-2 pr-2.5 pl-1.5 text-left text-sm font-medium text-paper transition-colors duration-[120ms] hover:bg-stone-800';

/** Locked segment: reads out the import's choice, no hover, can't open. */
const SEGMENT_LOCKED =
    'flex h-full items-center gap-2 pr-2.5 pl-1.5 text-left text-sm font-medium text-bone';

/**
 * The build importer: paste a PoB code or pobb.in link to read its allocation
 * in. The field stretches to fill the rest of the bar; on a phone it takes its
 * own row above the two buttons. Save & share persists the tree - the server
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
        <div className="relative flex w-full flex-wrap items-center gap-2 md:w-auto md:min-w-0 md:flex-1 md:flex-nowrap">
            <div
                className={`flex h-9 min-w-0 basis-full items-center gap-2 pr-1.5 pl-3 md:flex-1 md:basis-auto ${FIELD_SHELL}`}
            >
                <Link2
                    size={15}
                    strokeWidth={ICON_STROKE}
                    className="shrink-0 text-mist"
                    aria-hidden="true"
                />
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
                    className={FIELD_INPUT}
                />
                {code !== '' && (
                    <button
                        type="button"
                        onClick={() => onCode('')}
                        title="Clear input"
                        aria-label="Clear input"
                        className={FIELD_ICON_BUTTON}
                    >
                        <ClearGlyph />
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={onLoad}
                disabled={loading || code.trim() === ''}
                className="btn btn-iron flex-1 md:flex-none"
            >
                {loading ? 'Reading…' : 'Load build'}
            </button>
            <button
                type="button"
                onClick={onSave}
                disabled={!canSave || saving}
                title="Save this tree and get its public link and edit token"
                className="btn btn-copper flex-1 md:flex-none"
            >
                {saving ? 'Saving…' : 'Save & share'}
            </button>

            {error && <p className={`${FIELD_ERROR} left-0`}>{error}</p>}

            {saveError && !error && (
                <p className={`${FIELD_ERROR} right-0`}>{saveError}</p>
            )}
        </div>
    );
}

/**
 * The class and ascendancy pickers in one joined shell. When `locked` (a build
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
            <div className={PICKER_SHELL}>
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
                        <span className="w-px bg-line" aria-hidden="true" />
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
                <span>{name}</span>
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
                    <span>{name}</span>
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
                        <span>{cls.name}</span>
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
                <span>{current?.name ?? 'No ascendancy'}</span>
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
                    <span>{current?.name ?? 'No ascendancy'}</span>
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
                        <span className="grid size-[26px] place-items-center rounded-full border border-line-strong text-mist">
                            ✕
                        </span>
                        <span>No ascendancy</span>
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
                            <span>{asc.name}</span>
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
        <div ref={ref} className="relative h-full">
            <button
                type="button"
                onClick={() => setOpen((on) => !on)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                className={`block h-full ${FOCUS_RING}`}
            >
                {trigger}
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute top-full left-0 z-30 mt-1.5 max-h-96 min-w-[13rem] scroll-quiet overflow-auto rounded-[2px] border border-pewter-700 bg-stone-900 shadow-xl shadow-black/60"
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
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors duration-[120ms] focus-visible:outline-none ${
                active
                    ? 'bg-[linear-gradient(90deg,rgba(255,106,0,0.14),transparent_70%)] text-paper shadow-[inset_2px_0_0_var(--color-ember-500)]'
                    : 'text-bone hover:bg-stone-800 hover:text-paper focus-visible:bg-stone-800 focus-visible:text-paper'
            }`}
        >
            {children}
        </button>
    );
}

function Chevron() {
    return (
        <ChevronDown
            size={14}
            strokeWidth={ICON_STROKE}
            className="text-mist transition-colors duration-[120ms] group-hover:text-paper"
            aria-hidden="true"
        />
    );
}

/** Small padlock shown in place of the chevron when a picker is locked. */
function LockGlyph() {
    return (
        <Lock
            size={13}
            strokeWidth={ICON_STROKE}
            className="ml-0.5 text-mist"
            aria-hidden="true"
        />
    );
}
