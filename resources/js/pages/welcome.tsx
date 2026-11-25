import { Head, Link } from '@inertiajs/react';
import ReleaseCountdown, {
    HeroCountdown,
} from '@/components/release-countdown';
import RelicCube from '@/components/relic-cube';
import planner from '@/routes/planner';
import '../../css/landing.css';
import grille from '../../images/landing/grille.webp';
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
                <Layer image={treeIcon} className="painted" />
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

function Sword({ angle }: { angle: number }) {
    return (
        <g transform={`rotate(${angle} 45 48)`}>
            <path
                d="M37 67 40 60 41 13 45 4 49 14 49 60 53 67 46 65Z"
                fill="url(#landing-steel)"
                stroke="#473c32"
            />
            <path d="M45 8 45 60" fill="none" stroke="#fff5df" />
            <path
                d="M31 63Q45 57 59 63L61 68Q47 64 45 69Q43 65 29 68Z"
                fill="url(#landing-brass)"
                stroke="#897662"
            />
            <path d="M42 68H48L47 82H43Z" fill="#624535" stroke="#ceb998" />
            <path d="m43 70 4 2m-4 2 4 2m-4 2 3 2" stroke="#c3a78a" />
            <path d="m45 82 5 4-5 5-5-5Z" fill="url(#landing-brass)" />
        </g>
    );
}

function SwordsIcon() {
    return (
        <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 90 96"
            className="tool-icon"
        >
            <Sword angle={-42} />
            <Sword angle={42} />
        </svg>
    );
}

function FunnelIcon() {
    return (
        <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 90 96"
            className="tool-icon"
        >
            <path
                d="M11 27Q44 13 80 27L55 52Q49 59 49 63V77L39 84V63Q39 59 35 54Z"
                fill="url(#landing-steel)"
                stroke="#ead9bd"
                strokeWidth="2"
            />
            <path
                d="m15 31 27 8 1 36-4 8V62Q36 53 15 31Z"
                fill="#312e30"
                opacity=".8"
            />
            <ellipse
                cx="45"
                cy="27"
                rx="35"
                ry="9"
                fill="#231f20"
                stroke="#e9dcc4"
                strokeWidth="2.5"
            />
            <path d="M16 28q29-13 59 0" fill="none" stroke="#9e8d74" />
            <path
                d="m34 15 3-5 3 5-3 3Zm17-6 3-5 3 5-3 4Zm-5 12 3-4 3 4-3 4Z"
                fill="#ffb57d"
            />
        </svg>
    );
}

function BellIcon() {
    return (
        <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 90 96"
            className="tool-icon"
        >
            <path
                d="M40 17C35 4 54 3 51 18"
                fill="none"
                stroke="#d8c6a9"
                strokeWidth="3"
            />
            <path
                d="M19 62C27 56 24 46 27 34Q30 19 43 17Q61 15 65 36C67 49 66 56 74 64L77 69Q47 80 14 69Z"
                fill="url(#landing-steel)"
                stroke="#edddc5"
                strokeWidth="2"
            />
            <path
                d="M31 54Q31 26 41 23"
                fill="none"
                stroke="#e8dccb"
                strokeWidth="2"
            />
            <path
                d="M58 31Q63 43 61 54"
                fill="none"
                stroke="#594d40"
                strokeWidth="2"
            />
            <path
                d="M15 68Q45 59 76 68Q47 79 15 70Z"
                fill="#302b28"
                stroke="#ccb99a"
            />
            <path
                d="M39 72Q39 83 46 84Q53 84 54 72"
                fill="url(#landing-brass)"
                stroke="#c7b291"
            />
        </svg>
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
