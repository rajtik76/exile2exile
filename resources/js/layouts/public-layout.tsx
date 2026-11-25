import { Link, router, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Logo, PAGE_BG, PrimaryCta } from '@/components/brand';
import { PatchStatusWidget } from '@/components/patch-status';
import { home } from '@/routes';
import makerWordmark from '../../images/brand/rajtmajer-wordmark.svg';
import darkTile from '../../images/landing/dark-tile.webp';

/**
 * Shared chrome for every public page: a dark masthead over a pewter rule and a
 * void footer wrap the landing, the planners and the build viewer, so the whole
 * thing reads as one hand - "Exile to Exile", one player to another.
 */
export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const landing = useIsLanding();

    return (
        <div
            className="flex min-h-screen flex-col overflow-x-clip font-body text-paper"
            style={{ background: PAGE_BG }}
        >
            <TopBar landing={landing} />
            <main className="flex-1">{children}</main>
            <Footer landing={landing} />
        </div>
    );
}

/**
 * True on the landing page. The landing frames the masthead and footer like
 * its own sections: the painted texture behind the masthead and a 2240px cap
 * that fades out at both edges on wider windows. Every other page keeps them
 * plain and full width (the tree planner uses the whole window).
 */
function useIsLanding(): boolean {
    return usePage().url.split(/[?#]/)[0] === home.url();
}

/**
 * True on pages that carry their own copper action (save, unlock). Copper is
 * one per screen, so the masthead's "Build planner" turns iron there.
 */
function useHasOwnMainAction(): boolean {
    const { component } = usePage();

    return [
        'tree',
        'tree/unlock',
        'planner/edit',
        'planner/show',
        'planner/unlock',
    ].includes(component);
}

/** On the landing, cap a full-width band at 2240px and fade its edges beyond. */
const LANDING_CAP =
    'min-[821px]:mx-auto min-[821px]:w-full min-[821px]:max-w-[2240px] min-[2241px]:[mask-image:linear-gradient(90deg,transparent,black_2.5%,black_97.5%,transparent)]';

/** The tool/section links shared by the desktop nav and the mobile menu. */
const NAV_LINKS: { href: string; label: string; spa?: boolean }[] = [
    { href: '/tree', label: 'Tree', spa: true },
    { href: '/patch-webhook', label: 'Patches', spa: true },
];

/** The public repositories behind the project, listed in the GitHub menu. */
const GITHUB_LINKS: { href: string; label: string; kind: string }[] = [
    {
        href: 'https://github.com/rajtik76/exile2exile',
        label: 'Exile to Exile',
        kind: 'This whole site',
    },
    {
        href: 'https://github.com/rajtik76/poe2-toolkit',
        label: 'poe2-toolkit',
        kind: 'Passive-tree packages, also on npm',
    },
];

/**
 * Desktop "GitHub" nav entry: a button that unfolds a small panel with one row
 * per public repository. Closes on outside click, Escape, or following a link.
 */
function GitHubMenu() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex items-center gap-[0.3em] py-[0.6em] transition-colors duration-[120ms] hover:text-ember-300"
            >
                GitHub
                <svg
                    viewBox="0 0 10 6"
                    aria-hidden
                    className={`size-[0.45em] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                >
                    <path
                        d="M1 1l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-full right-0 z-20 mt-2 w-64 rounded-[2px] border border-pewter-700 bg-stone-900 p-1.5 font-ui shadow-xl shadow-black/60"
                >
                    {GITHUB_LINKS.map((link) => (
                        <a
                            key={link.href}
                            role="menuitem"
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setOpen(false)}
                            className="flex flex-col gap-0.5 rounded-[2px] px-3 py-2.5 transition-colors duration-[120ms] hover:bg-stone-800"
                        >
                            <span className="text-sm font-medium text-paper">
                                {link.label}
                            </span>
                            <span className="text-xs text-mist">
                                {link.kind}
                            </span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

/** A single nav entry, rendered as an Inertia <Link>, internal or external anchor. */
function NavItem({
    href,
    label,
    spa = false,
    className = '',
    onClick,
}: {
    href: string;
    label: string;
    spa?: boolean;
    className?: string;
    onClick?: () => void;
}) {
    const base = `transition-colors duration-[120ms] hover:text-ember-300 ${className}`;
    const external = href.startsWith('http');

    if (spa) {
        return (
            <Link href={href} className={base} onClick={onClick}>
                {label}
            </Link>
        );
    }

    return (
        <a
            href={href}
            className={base}
            onClick={onClick}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
            {label}
        </a>
    );
}

/** Three-line hamburger / X toggle for the mobile menu. */
function MenuToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
    const bar =
        'absolute left-1 h-px w-5 bg-current transition-transform duration-200';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="relative ml-auto inline-flex size-9 items-center justify-center text-paper transition-colors duration-[120ms] hover:text-ember-300 sm:hidden"
        >
            <span className="relative block size-5">
                <span
                    className={`${bar} ${open ? 'top-1/2 rotate-45' : 'top-[5px]'}`}
                />
                <span
                    className={`${bar} top-1/2 ${open ? 'opacity-0' : 'opacity-100'}`}
                />
                <span
                    className={`${bar} ${open ? 'top-1/2 -rotate-45' : 'bottom-[5px]'}`}
                />
            </span>
        </button>
    );
}

/** Hairline between two masthead nav entries. */
function NavDivider() {
    return <span aria-hidden className="h-[1em] w-px bg-[#82776c]" />;
}

/** The pewter rule: a 2px metal line that fades out at both ends. */
function PewterRule({ className = '' }: { className?: string }) {
    return <div aria-hidden className={`h-0.5 rule-pewter ${className}`} />;
}

function TopBar({ landing }: { landing: boolean }) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Close the mobile menu whenever a navigation starts (link followed, CTA fired).
    useEffect(() => router.on('start', () => setMenuOpen(false)), []);

    const ownMainAction = useHasOwnMainAction();

    const cta = ownMainAction ? (
        <Link href="/build-planner" className="btn btn-iron">
            Build planner
        </Link>
    ) : (
        <PrimaryCta href="/build-planner">Build planner</PrimaryCta>
    );

    return (
        <header
            className={`relative z-10 font-display text-paper ${landing ? LANDING_CAP : ''}`}
            style={{
                background: landing
                    ? `linear-gradient(90deg, #060a0fbd, #0d1722c4), url('${darkTile}')`
                    : 'linear-gradient(90deg, #060a0f, #0d1722)',
            }}
        >
            <div className="flex min-h-[var(--masthead-h)] items-center gap-4 px-[min(3.4%,76px)] max-[820px]:px-[6%]">
                <Link
                    href="/"
                    aria-label="Exile to Exile home"
                    className="text-[clamp(30px,2.9vw,50px)] transition-colors duration-[120ms] hover:text-ember-300"
                >
                    <Logo />
                </Link>

                {/* desktop nav: tool links + CTA from sm up */}
                <nav
                    aria-label="Main"
                    className="ml-auto hidden items-center gap-[1em] text-[clamp(18px,1.65vw,26px)] sm:flex"
                >
                    {NAV_LINKS.map((link) => (
                        <Fragment key={link.href}>
                            <NavItem {...link} className="py-[0.6em]" />
                            <NavDivider />
                        </Fragment>
                    ))}
                    <GitHubMenu />
                    {/* the landing has its own copper button in the hero */}
                    {!landing && (
                        <span className="hidden pl-[0.4em] lg:inline-flex">
                            {cta}
                        </span>
                    )}
                </nav>

                {/* mobile: hamburger toggle only */}
                <MenuToggle
                    open={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                />
            </div>

            <PewterRule className="absolute inset-x-[1.5%] bottom-0" />

            {/* mobile menu panel: links + CTA, collapses on sm up */}
            {menuOpen && (
                <nav aria-label="Main" className="bg-ink text-lg sm:hidden">
                    <div className="flex flex-col gap-1 px-[6%] py-3">
                        {NAV_LINKS.map((link) => (
                            <NavItem
                                key={link.href}
                                {...link}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-[2px] px-2 py-2.5 hover:bg-stone-800"
                            />
                        ))}
                        {/* the two public repos, flat - no dropdown on mobile */}
                        {GITHUB_LINKS.map((link) => (
                            <NavItem
                                key={link.href}
                                href={link.href}
                                label={`GitHub · ${link.label}`}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-[2px] px-2 py-2.5 hover:bg-stone-800"
                            />
                        ))}
                        <div className="mt-2 mb-1 [&>*]:w-full">{cta}</div>
                    </div>
                </nav>
            )}
        </header>
    );
}

/** Column heading: same treatment for every footer group. */
function FooterHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="mb-[0.7em] font-label text-[17px] tracking-[0.06em] text-pewter-300">
            {children}
        </h2>
    );
}

/** Footer link with a single shared hover treatment. */
function FooterLink({
    href,
    external = false,
    spa = false,
    children,
}: {
    href: string;
    external?: boolean;
    spa?: boolean;
    children: React.ReactNode;
}) {
    const className = 'transition-colors duration-[120ms] hover:text-ember-300';

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={className}
            >
                {children}
            </a>
        );
    }

    if (spa) {
        return (
            <Link href={href} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <a href={href} className={className}>
            {children}
        </a>
    );
}

/** A titled footer column of links. */
function FooterColumn({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <nav aria-label={title}>
            <FooterHeading>{title}</FooterHeading>
            <ul className="flex flex-col gap-[0.5em]">{children}</ul>
        </nav>
    );
}

function Footer({ landing }: { landing: boolean }) {
    return (
        <>
            <PewterRule className="relative z-10 mx-[max(1.5%,calc((100%_-_2172px)/2))]" />
            <footer
                className={`relative z-10 bg-void font-body text-base leading-normal text-slate ${landing ? LANDING_CAP : ''}`}
            >
                <div className="mx-auto max-w-[2240px] px-[min(4.15%,93px)] pt-[clamp(36px,4vw,64px)] pb-[34px]">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-8 min-[821px]:grid-cols-[1.4fr_repeat(3,1fr)]">
                        <div className="col-span-2 min-[821px]:col-span-1">
                            <Link
                                href="/"
                                aria-label="Exile to Exile home"
                                className="text-[34px] text-paper transition-colors duration-[120ms] hover:text-ember-300"
                            >
                                <Logo />
                            </Link>
                            <p className="mt-[0.7em] max-w-[20em] text-[17px] text-bone">
                                A few tools I made for Path of Exile&nbsp;2 and
                                put online for anyone to use.
                            </p>
                            <div className="mt-4">
                                <PatchStatusWidget />
                            </div>
                        </div>

                        <FooterColumn title="Tools">
                            <li>
                                <FooterLink href="/tree" spa>
                                    Tree planner
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink href="/build-planner" spa>
                                    Build planner
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink href="/patch-webhook" spa>
                                    Patch alerts
                                </FooterLink>
                            </li>
                        </FooterColumn>

                        <FooterColumn title="Project">
                            <li>
                                <FooterLink
                                    href="https://github.com/rajtik76/exile2exile"
                                    external
                                >
                                    Source on GitHub
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink
                                    href="https://github.com/rajtik76/poe2-toolkit"
                                    external
                                >
                                    poe2-toolkit on GitHub
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink href="/#why" spa>
                                    Why this exists
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink href="/credits" spa>
                                    Credits and licenses
                                </FooterLink>
                            </li>
                        </FooterColumn>

                        <FooterColumn title="Legal">
                            <li>
                                <FooterLink href="/privacy" spa>
                                    Privacy Policy
                                </FooterLink>
                            </li>
                            <li>
                                <FooterLink href="/terms" spa>
                                    Terms of Service
                                </FooterLink>
                            </li>
                        </FooterColumn>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3.5 border-t border-line pt-[22px] text-sm text-mist">
                        <a
                            href="https://rajtik.com"
                            className="inline-flex items-center gap-2.5 transition-colors duration-[120ms] hover:text-ember-300"
                        >
                            Made by
                            <img
                                src={makerWordmark}
                                alt="Rajtmajer"
                                className="h-5 w-auto"
                            />
                        </a>
                        <p className="max-w-[46em]">
                            Not affiliated with Grinding Gear Games. Path of
                            Exile&nbsp;2 and all related assets are trademarks
                            of Grinding Gear Games, used here for identification
                            only.
                        </p>
                    </div>
                </div>
            </footer>
        </>
    );
}
