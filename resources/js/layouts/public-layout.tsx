import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { PAGE_BG, PrimaryCta, Wordmark } from '@/components/brand';
import { usePatchStatus } from '@/lib/usePatchStatus';
import logoMark from '../../images/brand/e2e-mark.svg';

/**
 * Shared chrome for every public page: a quiet heraldic masthead and a stone
 * footer wrap the landing and the build viewer, so the whole thing reads as one
 * hand - "Exile to Exile", one player to another.
 */
export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="flex min-h-screen flex-col overflow-x-clip font-body text-[#d6dae2]"
            style={{ background: PAGE_BG, backgroundAttachment: 'fixed' }}
        >
            <TopBar />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}

/**
 * Patch read-out in a small rounded panel. Top row: the pulsing heartbeat and
 * the latest PoE2 version, a vertical divider, then the release age and
 * last-checked time stacked together (they're one pair) split by a hairline -
 * both kept fresh by the {@link usePatchStatus} poll. Below a divider, the
 * request-only patch the app's own data is built from, flagged current or behind.
 */
function PatchStatus() {
    const status = usePatchStatus();

    if (!status) {
        return null;
    }

    return (
        <div className="w-fit rounded-md border border-[#c9a24a]/25 bg-[#0c0c12]/80 px-3.5 py-2 font-ui text-[11px] text-[#a7acb8]">
            <div className="flex items-stretch gap-3">
                <span className="flex items-center gap-2">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#74b079] opacity-70" />
                        <span className="relative inline-flex size-2 rounded-full bg-[#74b079] shadow-[0_0_8px_#74b079]" />
                    </span>
                    <span className="text-xs font-semibold text-[#e6ecf6] tabular-nums">
                        PoE2&nbsp;{status.version}
                    </span>
                </span>

                <span className="w-px bg-[#c9a24a]/15" aria-hidden="true" />

                <div className="flex flex-col justify-center gap-1">
                    <span
                        className="tabular-nums"
                        title={new Date(status.releasedAt).toLocaleString()}
                    >
                        released {status.releasedAgo}
                    </span>
                    <span className="h-px bg-[#c9a24a]/15" aria-hidden="true" />
                    <span
                        className="tabular-nums"
                        title={new Date(status.checkedAt).toLocaleString()}
                    >
                        checked {status.checkedAgo}
                    </span>
                </div>
            </div>

            <div className="my-1.5 h-px bg-[#c9a24a]/15" />

            <div
                className="flex items-center gap-1.5"
                title="The patch the app's bundled game data is built from"
            >
                <span className="text-[#787d8a]">web data</span>
                <span className="font-semibold text-[#d6dae2] tabular-nums">
                    {status.dataVersion ?? '-'}
                </span>
                {status.dataVersion &&
                    (status.isDataCurrent ? (
                        <span className="text-[10px] font-medium text-[#8fc594]">
                            (current)
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-[#e0b070]">
                            (behind)
                        </span>
                    ))}
            </div>
        </div>
    );
}

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
                className="flex items-center gap-1.5 font-ui transition hover:text-[#ecd49a]"
            >
                GitHub
                <svg
                    viewBox="0 0 10 6"
                    aria-hidden
                    className={`size-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
                    className="absolute top-full right-0 mt-4 w-64 rounded-md border border-[#c9a24a]/25 bg-[#0c0c12]/95 p-1.5 shadow-xl shadow-black/60 backdrop-blur"
                >
                    {GITHUB_LINKS.map((link) => (
                        <a
                            key={link.href}
                            role="menuitem"
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setOpen(false)}
                            className="flex flex-col gap-0.5 rounded-sm px-3 py-2.5 transition hover:bg-[#c9a24a]/10"
                        >
                            <span className="text-sm font-medium text-[#d6dae2]">
                                {link.label}
                            </span>
                            <span className="text-xs text-[#787d8a]">
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
    const base = `font-ui transition hover:text-[#ecd49a] ${className}`;
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
            className="relative ml-auto inline-flex size-9 items-center justify-center text-[#d6dae2] transition hover:text-[#ecd49a] sm:hidden"
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

function TopBar() {
    const [menuOpen, setMenuOpen] = useState(false);

    // Close the mobile menu whenever a navigation starts (link followed, CTA fired).
    useEffect(() => router.on('start', () => setMenuOpen(false)), []);

    const cta = <PrimaryCta href="/build-planner">Build Planner</PrimaryCta>;

    return (
        <header className="sticky top-0 z-30 border-b border-[#c9a24a]/12 bg-[#08080b]/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
                {/* the E2E mark, then the wordmark it abbreviates */}
                <Link href="/" className="flex items-baseline gap-3">
                    <img
                        src={logoMark}
                        alt=""
                        aria-hidden
                        className="h-7 w-auto self-center"
                    />
                    <Wordmark className="text-lg text-[#f1f3f8]" />
                    <span className="hidden border-l border-[#c9a24a]/25 pl-3 font-ui text-xs text-[#a7acb8] sm:inline">
                        Free Path of Exile&nbsp;2 tools - one player to another
                    </span>
                </Link>

                {/* desktop nav: tool links + CTA from sm up */}
                <nav className="ml-auto hidden items-center gap-6 font-ui text-sm font-medium text-[#a7acb8] sm:flex">
                    {NAV_LINKS.map((link) => (
                        <NavItem key={link.href} {...link} />
                    ))}
                    <GitHubMenu />
                    <span className="hidden lg:inline-flex">{cta}</span>
                </nav>

                {/* mobile: hamburger toggle only */}
                <MenuToggle
                    open={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                />
            </div>

            {/* mobile menu panel: links + CTA, collapses on sm up */}
            {menuOpen && (
                <nav className="border-t border-[#c9a24a]/12 bg-[#08080b]/95 backdrop-blur sm:hidden">
                    <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
                        {NAV_LINKS.map((link) => (
                            <NavItem
                                key={link.href}
                                {...link}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-sm px-2 py-2.5 text-sm text-[#d6dae2] hover:bg-[#c9a24a]/10"
                            />
                        ))}
                        {/* the two public repos, flat - no dropdown on mobile */}
                        {GITHUB_LINKS.map((link) => (
                            <NavItem
                                key={link.href}
                                href={link.href}
                                label={`GitHub · ${link.label}`}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-sm px-2 py-2.5 text-sm text-[#d6dae2] hover:bg-[#c9a24a]/10"
                            />
                        ))}
                        <div className="mt-2 [&>*]:w-full [&>*]:justify-center">
                            {cta}
                        </div>
                    </div>
                </nav>
            )}
        </header>
    );
}

/** Column heading: same treatment for every footer group. */
function FooterHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="font-ui text-xs font-semibold tracking-[0.16em] text-[#c9a24a] uppercase">
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
    const className =
        'font-ui text-sm text-[#a7acb8] transition hover:text-[#ecd49a]';

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

function Footer() {
    return (
        <footer className="relative z-10 border-t border-[#c9a24a]/20 bg-[#060609]">
            <div className="mx-auto max-w-6xl px-4 py-12">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    {/* brand */}
                    <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2.5">
                            <img
                                src={logoMark}
                                alt=""
                                aria-hidden
                                className="h-6 w-auto"
                            />
                            <Wordmark className="text-base text-[#f1f3f8]" />
                        </div>
                        <p className="max-w-xs font-body text-sm leading-relaxed text-[#a7acb8]">
                            A few tools I made for Path of Exile&nbsp;2 and put
                            online for anyone to use. From one exile to another.
                        </p>
                        <PatchStatus />
                    </div>

                    {/* tools */}
                    <nav className="flex flex-col gap-2.5">
                        <FooterHeading>Tools</FooterHeading>
                        <FooterLink href="/tree" spa>
                            Tree planner
                        </FooterLink>
                        <FooterLink href="/build-planner" spa>
                            Build planner
                        </FooterLink>
                        <FooterLink href="/patch-webhook" spa>
                            Patch alerts
                        </FooterLink>
                    </nav>

                    {/* project */}
                    <nav className="flex flex-col gap-2.5">
                        <FooterHeading>Project</FooterHeading>
                        <FooterLink
                            href="https://discord.gg/mNcjdkcBFB"
                            external
                        >
                            Join the Discord
                        </FooterLink>
                        <FooterLink
                            href="https://github.com/rajtik76/exile2exile"
                            external
                        >
                            Source on GitHub
                        </FooterLink>
                        <FooterLink
                            href="https://github.com/rajtik76/poe2-toolkit"
                            external
                        >
                            poe2-toolkit on GitHub
                        </FooterLink>
                        <FooterLink href="/#why" spa>
                            Why this exists
                        </FooterLink>
                        <FooterLink href="/changelog" spa>
                            Changelog
                        </FooterLink>
                        <FooterLink href="/credits" spa>
                            Credits &amp; licenses
                        </FooterLink>
                    </nav>

                    {/* legal */}
                    <nav className="flex flex-col gap-2.5">
                        <FooterHeading>Legal</FooterHeading>
                        <FooterLink href="/privacy" spa>
                            Privacy Policy
                        </FooterLink>
                        <FooterLink href="/terms" spa>
                            Terms of Service
                        </FooterLink>
                    </nav>
                </div>

                {/* bottom bar: credit + coffee + GGG disclaimer */}
                <div className="mt-10 flex flex-col gap-4 border-t border-[#c9a24a]/12 pt-6 font-ui text-xs leading-relaxed text-[#787d8a] sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        © {new Date().getFullYear()} Vladislav Rajtmajer
                        <span className="px-1.5 text-[#c9a24a]/60">·</span>
                        <span className="text-[#d6dae2]">rajtik#1215</span>
                        <span className="px-1.5 text-[#c9a24a]/60">·</span>
                        made over a cup of coffee&nbsp;☕
                    </p>
                    <p className="max-w-md sm:text-right">
                        Not affiliated with Grinding Gear Games. Path of
                        Exile&nbsp;2 and all related assets are trademarks of
                        Grinding Gear Games, used here for identification only.
                    </p>
                </div>
            </div>
        </footer>
    );
}
