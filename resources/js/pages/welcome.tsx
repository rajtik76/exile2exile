import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import ReleaseCountdown, {
    HeroCountdown,
} from '@/components/release-countdown';
import RelicCube from '@/components/relic-cube';
import planner from '@/routes/planner';
import '../../css/landing.css';
import grille from '../../images/landing/grille.webp';
import treeFruit from '../../images/landing/icon-tree-fruit.webp';
import treeIcon from '../../images/landing/icon-tree.webp';
import railCollar from '../../images/landing/rail-collar.webp';
import scene from '../../images/landing/scene.webp';

/**
 * The landing ("Reliquary"): a painted relic chamber with a live ember cube
 * behind its grille, the tools shelf, the launch countdown and a short note
 * on why this exists. Layout and art live in landing.css.
 */
export default function Welcome() {
    return (
        <>
            <Head title="Free Path of Exile 2 tools">
                <meta
                    name="description"
                    content="A free, fan-made set of Path of Exile 2 tools, one player to another: plan a passive tree, write a phased build guide, turn it into a loot filter, or get pinged when a new patch ships. No ads, no accounts."
                />
            </Head>

            <div className="landing">
                <SvgDefs />
                <div className="first">
                    <Hero />
                    <ToolsShelf />
                </div>
                <ReleaseCountdown />
                <div className="rule" aria-hidden />
                <About />
            </div>
        </>
    );
}

/** Shared SVG paint: the metal of the shelf icons. */
function SvgDefs() {
    return (
        <svg
            width="0"
            height="0"
            aria-hidden
            focusable="false"
            className="absolute"
        >
            <defs>
                <linearGradient id="landing-steel" x2="95%" y2="30%">
                    <stop stopColor="#655749" />
                    <stop offset=".23" stopColor="#eee2cf" />
                    <stop offset=".39" stopColor="#aa9b89" />
                    <stop offset=".57" stopColor="#5a5550" />
                    <stop offset=".8" stopColor="#c5b6a0" />
                    <stop offset="1" stopColor="#78695b" />
                </linearGradient>
                <linearGradient id="landing-brass" x2="100%" y2="55%">
                    <stop stopColor="#76604b" />
                    <stop offset=".4" stopColor="#e2c8a9" />
                    <stop offset=".6" stopColor="#7a6350" />
                    <stop offset="1" stopColor="#ba9876" />
                </linearGradient>
                <linearGradient id="landing-polished" x2="95%" y2="30%">
                    <stop stopColor="#5f6872" />
                    <stop offset=".2" stopColor="#fff" />
                    <stop offset=".36" stopColor="#c4ced6" />
                    <stop offset=".52" stopColor="#48515a" />
                    <stop offset=".74" stopColor="#eef4f8" />
                    <stop offset="1" stopColor="#7c8791" />
                </linearGradient>
                <linearGradient id="landing-gold" x2="95%" y2="30%">
                    <stop stopColor="#6b4a14" />
                    <stop offset=".23" stopColor="#fbe8a6" />
                    <stop offset=".39" stopColor="#d1a54a" />
                    <stop offset=".57" stopColor="#7a5719" />
                    <stop offset=".8" stopColor="#f0cc6e" />
                    <stop offset="1" stopColor="#8f6a26" />
                </linearGradient>
                <linearGradient id="landing-gold-sheen" x2="100%">
                    <stop stopColor="#5c3f10" />
                    <stop offset=".3" stopColor="#a77a2a" />
                    <stop offset=".55" stopColor="#d9ac4c" />
                    <stop offset=".76" stopColor="#fff3c4" />
                    <stop offset=".86" stopColor="#e6bb55" />
                    <stop offset="1" stopColor="#7d5a1b" />
                </linearGradient>
                <linearGradient id="landing-glint" x2="0" y2="100%">
                    <stop offset=".4" stopColor="#fff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#fff" stopOpacity=".9" />
                    <stop offset=".6" stopColor="#fff" stopOpacity="0" />
                    <animateTransform
                        attributeName="gradientTransform"
                        type="translate"
                        values="0 1; 0 -1; 0 -1"
                        keyTimes="0; .45; 1"
                        dur="2.2s"
                        repeatCount="indefinite"
                    />
                </linearGradient>
            </defs>
        </svg>
    );
}

function Hero() {
    return (
        <section className="hero" aria-labelledby="page-title">
            <div className="scene" aria-hidden>
                <div className="relic">
                    <div className="plate">
                        <Layer image={scene} />
                        <RelicCube />
                        <Layer image={grille} />
                    </div>
                </div>
                <div className="foreground" />
            </div>

            <div className="intro">
                <HeroCountdown />
                <h1 id="page-title">
                    Exile to <br />
                    Exile
                </h1>
                <p className="tagline">Free tools for Path of Exile 2.</p>
                <Link className="cta" href={planner.create.url()}>
                    Plan a build
                </Link>
            </div>
        </section>
    );
}

/**
 * A painted layer of the scene. Drawn as a background rather than an <img> so
 * reader views do not pick the decoration up as article pictures.
 */
function Layer({
    image,
    className = 'layer',
}: {
    image: string;
    className?: string;
}) {
    return (
        <div
            className={className}
            style={{ backgroundImage: `url('${image}')` }}
        />
    );
}

function ToolsShelf() {
    return (
        <nav
            className="shelf"
            id="tools"
            aria-label="Path of Exile 2 tools"
            tabIndex={-1}
        >
            <Layer image={railCollar} className="collar" />
            <Link className="tool" href="/tree">
                <div className="painted">
                    <Layer image={treeIcon} />
                    <Layer image={treeFruit} className="layer lit" />
                </div>
                <ToolText name="Tree planner" kind="Map your passives" />
            </Link>
            <Link className="tool" href={planner.create.url()}>
                <SwordsIcon />
                <ToolText name="Build planner" kind="Plan gear and gems" />
            </Link>
            <Link className="tool" href={planner.create.url()}>
                <FunnelIcon />
                <ToolText name="Build filter" kind="Create a loot filter" />
            </Link>
            <Link className="tool" href="/patch-webhook">
                <BellIcon />
                <ToolText name="Patch alerts" kind="Connect a webhook" />
            </Link>
        </nav>
    );
}

function ToolText({ name, kind }: { name: string; kind: string }) {
    return (
        <span>
            <strong>{name}</strong>
            <small>{kind}</small>
        </span>
    );
}

/**
 * A shelf icon drawn twice: at rest, and lit for hover and focus. CSS
 * cross-fades the two.
 */
function ToolIcon({ draw }: { draw: (lit: boolean) => ReactNode }) {
    return (
        <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 90 96"
            className="tool-icon"
        >
            <g className="rest">{draw(false)}</g>
            <g className="lit">{draw(true)}</g>
        </svg>
    );
}

const BLADE = 'M37 67 40 60 41 13 45 4 49 14 49 60 53 67 46 65Z';

function Sword({ angle, lit }: { angle: number; lit: boolean }) {
    const hilt = lit ? 'url(#landing-gold)' : 'url(#landing-brass)';

    return (
        <g transform={`rotate(${angle} 45 48)`}>
            <path
                d={BLADE}
                fill={lit ? 'url(#landing-polished)' : 'url(#landing-steel)'}
                stroke={lit ? '#39414a' : '#473c32'}
            />
            {lit && (
                <path className="glint" d={BLADE} fill="url(#landing-glint)" />
            )}
            <path
                d="M45 8 45 60"
                fill="none"
                stroke={lit ? '#fff' : '#fff5df'}
            />
            <path
                d="M31 63Q45 57 59 63L61 68Q47 64 45 69Q43 65 29 68Z"
                fill={hilt}
                stroke={lit ? '#f6d784' : '#897662'}
            />
            <path
                d="M42 68H48L47 82H43Z"
                fill={lit ? '#5a3a14' : '#624535'}
                stroke={lit ? '#f0c766' : '#ceb998'}
            />
            <path
                d="m43 70 4 2m-4 2 4 2m-4 2 3 2"
                stroke={lit ? '#ffd97a' : '#c3a78a'}
            />
            <path d="m45 82 5 4-5 5-5-5Z" fill={hilt} />
        </g>
    );
}

function SwordsIcon() {
    return (
        <ToolIcon
            draw={(lit) => (
                <>
                    <Sword angle={-42} lit={lit} />
                    <Sword angle={42} lit={lit} />
                </>
            )}
        />
    );
}

function FunnelIcon() {
    return (
        <ToolIcon
            draw={(lit) => (
                <>
                    <path
                        d="M11 27Q44 13 80 27L55 52Q49 59 49 63V77L39 84V63Q39 59 35 54Z"
                        fill={
                            lit ? 'url(#landing-gold)' : 'url(#landing-steel)'
                        }
                        stroke={lit ? '#f8de92' : '#ead9bd'}
                        strokeWidth="2"
                    />
                    <path
                        d="m15 31 27 8 1 36-4 8V62Q36 53 15 31Z"
                        fill={lit ? '#3b2a10' : '#312e30'}
                        opacity=".8"
                    />
                    <ellipse
                        cx="45"
                        cy="27"
                        rx="35"
                        ry="9"
                        fill={lit ? '#1f170b' : '#231f20'}
                        stroke={lit ? '#f4d27c' : '#e9dcc4'}
                        strokeWidth="2.5"
                    />
                    <path
                        d="M16 28q29-13 59 0"
                        fill="none"
                        stroke={lit ? '#b8913f' : '#9e8d74'}
                    />
                    <path
                        className={lit ? 'orbs' : undefined}
                        d="m34 15 3-5 3 5-3 3Zm17-6 3-5 3 5-3 4Zm-5 12 3-4 3 4-3 4Z"
                        fill={lit ? '#6fd0ff' : '#ffb57d'}
                    />
                </>
            )}
        />
    );
}

function BellIcon() {
    return (
        <ToolIcon
            draw={(lit) => (
                <>
                    <path
                        d="M40 17C35 4 54 3 51 18"
                        fill="none"
                        stroke={lit ? '#e8c46a' : '#d8c6a9'}
                        strokeWidth="3"
                    />
                    <path
                        d="M19 62C27 56 24 46 27 34Q30 19 43 17Q61 15 65 36C67 49 66 56 74 64L77 69Q47 80 14 69Z"
                        fill={
                            lit
                                ? 'url(#landing-gold-sheen)'
                                : 'url(#landing-steel)'
                        }
                        stroke={lit ? '#f8de92' : '#edddc5'}
                        strokeWidth="2"
                    />
                    <path
                        d="M31 54Q31 26 41 23"
                        fill="none"
                        stroke={lit ? '#f2d58a' : '#e8dccb'}
                        strokeWidth="2"
                        opacity={lit ? 0.6 : 1}
                    />
                    <path
                        d="M58 31Q63 43 61 54"
                        fill="none"
                        stroke={lit ? '#fffbea' : '#594d40'}
                        strokeWidth={lit ? 3 : 2}
                        strokeLinecap="round"
                    />
                    {lit && (
                        <path
                            className="sparkle"
                            d="M62 22 63.5 27 68 28.5 63.5 30 62 35 60.5 30 56 28.5 60.5 27Z"
                            fill="#fffbea"
                        />
                    )}
                    <path
                        d="M15 68Q45 59 76 68Q47 79 15 70Z"
                        fill={lit ? '#3a2a10' : '#302b28'}
                        stroke={lit ? '#f0c870' : '#ccb99a'}
                    />
                    <path
                        d="M39 72Q39 83 46 84Q53 84 54 72"
                        fill={
                            lit ? 'url(#landing-gold)' : 'url(#landing-brass)'
                        }
                        stroke={lit ? '#f6d784' : '#c7b291'}
                    />
                </>
            )}
        />
    );
}

/** Why this exists, in the author's own words, over the candlelit book. */
function About() {
    return (
        <section className="about" id="why" aria-labelledby="about-title">
            <div>
                <h2 id="about-title">A few tools, made by a player</h2>
                <p>
                    Plan a passive tree, lay a whole build out as a phased
                    guide, turn that build into an in-game loot filter, or get
                    pinged the moment a new patch ships. Every tool reads
                    straight from the official game files.
                </p>
                <blockquote>
                    No ads, no accounts, nothing to buy, and the whole thing is
                    open source. It started as a passive-tree planner I wanted
                    for myself, and grew from there.
                </blockquote>
                <p className="signoff">From one exile to another.</p>
            </div>
        </section>
    );
}
