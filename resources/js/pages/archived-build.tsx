import { Head } from '@inertiajs/react';
import { CONTACT_EMAIL, ENGRAVED } from '@/components/brand';
import { PANEL_FONT } from '@/components/passive-tree/chrome';

/**
 * The stand-in viewer for a saved tree or plan that is not of the live game era. Its
 * nodes, items and gems belong to another era's data, so it is not drawn over the
 * live tree: only what the saved row itself holds is shown, until older eras can be
 * rendered from their own frozen data. Wears the tree pages' engraved-bronze chrome.
 *
 * With no era at all (its patch fell out of the server's era map) it is an error on
 * our side, not an old build, so the page says so and asks the visitor to get in
 * touch.
 */
export default function ArchivedBuild({
    kind,
    title,
    className,
    gameEra,
    eraName,
    gamePatch,
}: {
    kind: 'tree' | 'plan';
    title: string;
    className: string | null;
    gameEra: string | null;
    eraName: string | null;
    gamePatch: string;
}) {
    const noun = kind === 'tree' ? 'tree' : 'build guide';
    const version =
        gameEra === null
            ? null
            : `Path of Exile 2 version ${gameEra}${eraName ? ` (${eraName})` : ''}`;

    return (
        <div className="mx-auto max-w-lg px-4 pt-16 pb-28" style={PANEL_FONT}>
            <Head title={title} />

            <header className="mb-6 flex items-center gap-4">
                <span
                    className="grid size-14 shrink-0 place-items-center rounded-full text-xl text-[#e6d2a0]"
                    style={{
                        background:
                            'radial-gradient(circle at 50% 30%, #2a1d0c, #0b0805 80%)',
                        boxShadow:
                            'inset 0 0 0 2px rgba(199,154,63,0.7), 0 0 24px -8px rgba(240,200,105,0.45)',
                    }}
                >
                    {(className ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-[#b39a64] uppercase">
                        {kind === 'tree' ? 'Passive tree' : 'Build guide'}
                        {gameEra !== null && ` · PoE2 ${gameEra}`}
                        {eraName && ` · ${eraName}`}
                    </p>
                    <h1
                        className="mt-1 text-2xl break-words text-[#ffe6a8] sm:text-3xl"
                        style={ENGRAVED}
                    >
                        {title}
                    </h1>
                </div>
            </header>

            {version === null ? (
                <div className="rounded-xl border border-[#8a3a2a] bg-gradient-to-b from-[#1a0c09] to-[#0b0805] p-4 shadow-lg shadow-black/45 sm:p-5">
                    <p className="text-sm text-[#e0a58f]">
                        Something is wrong on our side: this {noun} cannot be
                        matched to a version of Path of Exile 2 (it was saved on
                        game patch {gamePatch}), so it cannot be shown.
                    </p>
                    <p className="mt-3 text-sm text-[#cdb784]">
                        Please get in touch at{' '}
                        <a
                            href={`mailto:${CONTACT_EMAIL}`}
                            className="text-[#ecc878] underline underline-offset-2 hover:text-[#ffdf9a]"
                        >
                            {CONTACT_EMAIL}
                        </a>{' '}
                        and include this page's link, so it can be put right.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-[#6e5526] bg-gradient-to-b from-[#15100a] to-[#0b0805] p-4 shadow-lg shadow-black/45 sm:p-5">
                    <p className="text-sm text-[#cdb784]">
                        This {noun}
                        {className ? ` for the ${className}` : ''} was made on{' '}
                        {version}. The game has moved on since, so it can no
                        longer be drawn over the current passive tree.
                    </p>
                    <p className="mt-3 text-sm text-[#8a7850]">
                        It is kept safe and read-only. Viewing builds from older
                        versions is on its way.
                    </p>
                </div>
            )}
        </div>
    );
}
