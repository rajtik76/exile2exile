import { Head, Link } from '@inertiajs/react';
import { Eyebrow } from '@/components/brand';
// Bundled by Vite (hashed asset): a lone exile at the broken end of a bridge.
import errorArt from '../../images/error/dead-end.webp';

/**
 * One Inertia page for every HTTP error the handler chooses to render. The
 * painted scene carries the mood - an exile standing where the road ends -
 * and the text under it says plainly what happened and offers the ways back
 * into the working tools.
 */
type ErrorCopy = {
    /** Plain name of the error, shown next to the status code. */
    kind: string;
    /** Display title - what happened, in the game's tone but legible. */
    title: string;
    /** The one plain, useful sentence. Active voice, no apology. */
    lead: string;
    /** Flavour line, always italic. Atmosphere, never information. */
    flavor: string;
};

const COPY: Record<number, ErrorCopy> = {
    403: {
        kind: 'Forbidden',
        title: 'This gate stays shut',
        lead: "You don't have access to this page. Head back and take another way.",
        flavor: 'sealed long before you got here',
    },
    404: {
        kind: 'Not found',
        title: 'The road ends here',
        lead: 'The page you followed does not exist. The link may be broken, or the tool has moved.',
        flavor: 'every exile walks into a dead end sooner or later',
    },
    419: {
        kind: 'Expired',
        title: 'The torch burned out',
        lead: 'Your session expired before the request landed. Go back and try again from a fresh page.',
        flavor: 'even the brightest flame needs tending',
    },
    500: {
        kind: 'Server error',
        title: 'Something gave way',
        lead: 'Something failed on our side. It has been logged - give it a moment and try again.',
        flavor: 'old stone holds, until it does not',
    },
    503: {
        kind: 'Maintenance',
        title: 'Closed for repairs',
        lead: 'The tools are down for a short maintenance. They will be back soon.',
        flavor: 'hold fast, exile',
    },
};

/** The tools a lost visitor can still walk straight into. */
const WAYS_BACK: { name: string; href: string }[] = [
    { name: 'Tree planner', href: '/tree' },
    { name: 'Build planner', href: '/build-planner' },
    { name: 'Patch alerts', href: '/patch-webhook' },
];

export default function ErrorPage({ status }: { status: number }) {
    const copy = COPY[status] ?? COPY[404];
    const code = COPY[status] ? status : 404;

    return (
        <div className="pb-20">
            <Head title={`${copy.title} - Error ${code}`} />

            <div
                aria-hidden
                className="error-art"
                style={
                    {
                        '--error-art': `url('${errorArt}')`,
                    } as React.CSSProperties
                }
            />

            {/* The code stands half inside the scene, where it fades out. */}
            <section className="relative mx-auto -mt-[clamp(64px,9vw,128px)] flex max-w-3xl flex-col items-center px-6 text-center">
                <p
                    aria-hidden
                    className="error-code font-display text-[clamp(112px,15vw,216px)] leading-[0.9]"
                >
                    {code}
                </p>

                <div className="mt-3">
                    <Eyebrow>
                        Error {code} · {copy.kind}
                    </Eyebrow>
                </div>

                <h1 className="mt-3 font-display text-[30px] leading-[1.15] text-paper [word-spacing:-0.1em] sm:text-[44px] sm:leading-[1.1]">
                    {copy.title}
                </h1>

                <p className="mt-4 max-w-[32em] font-body text-[18px] leading-[1.6] text-bone">
                    {copy.lead}
                </p>

                <p className="mt-2 max-w-[32em] font-body text-[17px] leading-[1.6] text-mist italic">
                    {copy.flavor}
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link href="/" className="btn btn-copper btn-lg">
                        Back to the start
                    </Link>
                    {WAYS_BACK.map((way) => (
                        <Link
                            key={way.href}
                            href={way.href}
                            className="btn btn-iron btn-lg"
                        >
                            {way.name}
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
