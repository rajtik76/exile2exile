import { Head } from '@inertiajs/react';
import { CONTACT_EMAIL } from '@/components/brand';
import { LABEL, MEDALLION } from '@/components/passive-tree/chrome';

/**
 * The stand-in viewer for a saved tree or plan that is not of the live game era. Its
 * nodes, items and gems belong to another era's data, so it is not drawn over the
 * live tree: only what the saved row itself holds is shown, until older eras can be
 * rendered from their own frozen data. Wears the working-tier panel of the tree pages.
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
        <div className="mx-auto max-w-lg px-4 pt-16 pb-28 font-ui">
            <Head title={title} />

            <header className="mb-6 flex items-center gap-4">
                <span
                    className={`${MEDALLION} size-14 font-display text-2xl text-paper`}
                >
                    {(className ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className={LABEL}>
                        {kind === 'tree' ? 'Passive tree' : 'Build guide'}
                        {gameEra !== null && ` · PoE2 ${gameEra}`}
                        {eraName && ` · ${eraName}`}
                    </p>
                    <h1 className="mt-0.5 font-display text-[30px] leading-[1.15] break-words text-paper [word-spacing:-0.1em]">
                        {title}
                    </h1>
                </div>
            </header>

            {version === null ? (
                <div className="notice notice-bad p-4 sm:p-5">
                    <p className="text-[15px] text-blood-lit">
                        Something is wrong on our side: this {noun} cannot be
                        matched to a version of Path of Exile 2 (it was saved on
                        game patch {gamePatch}), so it cannot be shown.
                    </p>
                    <p className="mt-3 text-[15px]">
                        Please get in touch at{' '}
                        <a href={`mailto:${CONTACT_EMAIL}`} className="link">
                            {CONTACT_EMAIL}
                        </a>{' '}
                        and include this page's link, so it can be put right.
                    </p>
                </div>
            ) : (
                <div className="panel p-4 sm:p-5">
                    <p className="text-[15px] text-bone">
                        This {noun}
                        {className ? ` for the ${className}` : ''} was made on{' '}
                        {version}. The game has moved on since, so it can no
                        longer be drawn over the current passive tree.
                    </p>
                    <p className="mt-3 text-[15px] text-mist">
                        It is kept safe and read-only. Viewing builds from older
                        versions is on its way.
                    </p>
                </div>
            )}
        </div>
    );
}
