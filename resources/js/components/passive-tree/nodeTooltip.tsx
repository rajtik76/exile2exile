import type {
    JewelInfo,
    NodeKind,
    NodeOption,
    TreeNode,
} from '@poe2-toolkit/tree-core';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { placeTooltip } from './tooltipPlacement';

const TOOLTIP_FRAME_URL: string | null = null;
const TOOLTIP_FRAME_SLICE = 28;

const ATTRIBUTE_PICKS: {
    key: 'any' | 'str' | 'dex' | 'int';
    label: string;
    color: string;
}[] = [
    { key: 'any', label: 'Any', color: '#caa45c' },
    { key: 'str', label: 'Strength', color: '#e06a6a' },
    { key: 'dex', label: 'Dexterity', color: '#79c46a' },
    { key: 'int', label: 'Intelligence', color: '#6aa6e0' },
];

const RARITY_TEXT: Record<string, string> = {
    NORMAL: '#d6d6d6',
    MAGIC: '#8888ff',
    RARE: '#e8e84a',
    UNIQUE: '#cf7a3a',
};

const TOOLTIP_TITLE: Record<NodeKind, string> = {
    keystone: '#e7a23a',
    notable: '#efe8d6',
    mastery: '#b9a9ff',
    jewel: '#efe8d6',
    attribute: '#efe8d6',
    normal: '#efe8d6',
    classStart: '#e9c98a',
    ascendancyStart: '#e9c98a',
    ascendancyNormal: '#c5cdd9',
    ascendancyNotable: '#e9c98a',
};

/**
 * Node tooltip styled like the in-game / Path of Building tooltip: an ornate
 * bronze frame, a kind-coloured title and the granted modifiers in passive-blue.
 * Follows the cursor, or pins above a node when a picker is anchored to it.
 */
export function NodeTooltip({
    node,
    kind,
    pointer,
    stage,
    allocated,
    attributeOption,
    jewel,
    anchor,
    pick,
}: {
    node: TreeNode;
    kind: NodeKind;
    pointer: { x: number; y: number };
    stage: HTMLElement | null;
    allocated: boolean;
    attributeOption?: NodeOption;
    jewel?: JewelInfo;
    anchor?: { x: number; y: number };
    pick?: {
        value?: 'str' | 'dex' | 'int';
        onPick: (attribute: 'any' | 'str' | 'dex' | 'int') => void;
        onClear: () => void;
    };
}) {
    const [hoverPick, setHoverPick] = useState<string | null>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState({ w: 0, h: 0 });
    const width = stage?.clientWidth ?? 0;
    const height = stage?.clientHeight ?? 0;

    const stats = attributeOption ? attributeOption.stats : node.stats;

    // Measure the rendered tooltip so its position can be clamped inside the
    // stage - without the real size, an anchored or edge-of-screen tooltip would
    // overflow the viewport (the whole point on a phone).
    useLayoutEffect(() => {
        const element = tipRef.current;

        if (!element) {
            return;
        }

        const next = { w: element.offsetWidth, h: element.offsetHeight };

        // Only commit a real size change - the effect re-runs on every cursor move,
        // and a same-size update would spin an extra render each time.
        setTip((prev) =>
            prev.w === next.w && prev.h === next.h ? prev : next,
        );
    }, [node, anchor, pointer.x, pointer.y, width, height, pick, jewel]);

    const { left, top } = placeTooltip({
        tip,
        stage: { w: width, h: height },
        pointer,
        anchor,
    });

    // Hidden until measured, so it never flashes at an unclamped position.
    const style: CSSProperties = { left, top, opacity: tip.w ? 1 : 0 };

    const body = (
        <>
            <div
                className="px-4 pt-2.5 pb-1.5 text-center text-xl sm:px-5 sm:text-2xl"
                style={{
                    color: TOOLTIP_TITLE[kind],
                    fontFamily: "'Fontin SmallCaps', 'Cinzel', serif",
                }}
            >
                {node.name || `#${node.skill}`}
            </div>

            <div
                className="mx-4 mb-2 h-px"
                style={{
                    background:
                        'linear-gradient(90deg,transparent,rgba(201,160,90,0.55),transparent)',
                }}
            />

            {stats.length > 0 && (
                <ul className="space-y-1 px-4 pb-2.5 text-left text-sm leading-snug sm:px-5 sm:text-lg">
                    {stats.map((stat, index) => (
                        <li key={index} className="text-[#aeb6ff]">
                            {highlightNumbers(stat)}
                        </li>
                    ))}
                </ul>
            )}

            {node.flavourText && (
                <div className="px-4 pb-2.5 text-left text-sm text-[#9a8b6e] italic sm:px-5 sm:text-lg">
                    {node.flavourText}
                </div>
            )}

            {jewel && (
                <div className="px-5 pb-3 text-center">
                    {jewel.icon && (
                        <img
                            src={jewel.icon}
                            alt=""
                            className="mx-auto mb-1.5 h-10 w-10 object-contain"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <div
                        className="text-xl"
                        style={{
                            color: RARITY_TEXT[jewel.rarity] ?? '#d6d6d6',
                        }}
                    >
                        {jewel.name || jewel.baseType}
                    </div>
                    {jewel.name &&
                        jewel.baseType &&
                        jewel.name !== jewel.baseType && (
                            <div className="text-sm text-[#9a8b6e]">
                                {jewel.baseType}
                            </div>
                        )}
                    {jewel.mods.length > 0 && (
                        <ul className="mt-1.5 space-y-1 text-left text-lg leading-snug">
                            {jewel.mods.map((mod, index) => (
                                <li key={index} className="text-[#aeb6ff]">
                                    {highlightNumbers(mod)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {pick ? (
                <div
                    className="px-4 pt-0.5 pb-3"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="pointer-events-auto flex flex-col gap-1.5">
                        {ATTRIBUTE_PICKS.map((option) => {
                            const active = (pick.value ?? 'any') === option.key;
                            const hover = hoverPick === option.key;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => pick.onPick(option.key)}
                                    onPointerEnter={() =>
                                        setHoverPick(option.key)
                                    }
                                    onPointerLeave={() =>
                                        setHoverPick((current) =>
                                            current === option.key
                                                ? null
                                                : current,
                                        )
                                    }
                                    className="w-full rounded-[3px] border px-2.5 py-1 text-center text-sm font-semibold tracking-[0.06em] transition-all"
                                    style={{
                                        color: active
                                            ? '#0a0a0a'
                                            : option.color,
                                        backgroundColor: active
                                            ? option.color
                                            : hover
                                              ? `${option.color}26`
                                              : 'transparent',
                                        borderColor:
                                            active || hover
                                                ? option.color
                                                : `${option.color}66`,
                                        boxShadow: active
                                            ? `0 0 10px ${option.color}77`
                                            : 'none',
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={pick.onClear}
                            className="mt-0.5 w-full rounded-[3px] border border-[#46454d] px-2.5 py-1 text-center text-xs font-semibold tracking-[0.16em] text-[#a7acb8] uppercase transition-all hover:bg-[#a7acb8] hover:text-[#0a0a0a]"
                        >
                            Clear path
                        </button>
                    </div>
                </div>
            ) : (
                allocated && (
                    <div className="px-5 pb-2.5 text-center text-xs tracking-[0.16em] text-[#6f9f8f] uppercase">
                        Allocated
                    </div>
                )
            )}
        </>
    );

    // Width capped to the viewport so a wide node never spills off a phone; left/
    // top are computed (and clamped) above, so no translate is needed.
    const base =
        'pointer-events-none absolute z-20 w-max max-w-[min(92vw,42rem)] shadow-xl shadow-black/70 transition-opacity duration-75';
    const font: CSSProperties = { fontFamily: "'Fontin', serif" };

    if (TOOLTIP_FRAME_URL) {
        return (
            <div
                ref={tipRef}
                className={base}
                style={{
                    ...style,
                    ...font,
                    borderStyle: 'solid',
                    borderWidth: TOOLTIP_FRAME_SLICE,
                    borderImage: `url(${TOOLTIP_FRAME_URL}) ${TOOLTIP_FRAME_SLICE} fill stretch`,
                }}
            >
                {body}
            </div>
        );
    }

    return (
        <div ref={tipRef} className={base} style={{ ...style, ...font }}>
            <div
                className="relative rounded-[4px] p-[2.5px]"
                style={{
                    background:
                        'linear-gradient(150deg,#9a7c42 0%,#4a3c20 35%,#241d10 70%,#5a4827 100%)',
                    boxShadow:
                        '0 0 0 1px rgba(0,0,0,0.75), 0 10px 26px rgba(0,0,0,0.6)',
                }}
            >
                <div
                    className="rounded-[2.5px] bg-gradient-to-b from-[#16130d] to-[#070605] pt-0.5"
                    style={{
                        boxShadow:
                            'inset 0 0 0 1px rgba(201,160,90,0.22), inset 0 1px 10px rgba(0,0,0,0.7)',
                    }}
                >
                    {body}
                </div>
                <TooltipCorner className="absolute -top-px -left-px" />
                <TooltipCorner className="absolute -top-px -right-px rotate-90" />
                <TooltipCorner className="absolute -right-px -bottom-px rotate-180" />
                <TooltipCorner className="absolute -bottom-px -left-px -rotate-90" />
            </div>
        </div>
    );
}

function TooltipCorner({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M1.5 15 V5 Q1.5 1.5 5 1.5 H15"
                stroke="#caa45c"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
            <path
                d="M4 8 L8 4"
                stroke="#e6c87e"
                strokeWidth="1"
                strokeLinecap="round"
            />
            <path d="M3.5 3.5 l1.6 1.6 -1.6 1.6 -1.6 -1.6 z" fill="#eccd84" />
        </svg>
    );
}

function highlightNumbers(text: string) {
    return text.split(/(\d+(?:\.\d+)?)/g).map((part, index) =>
        /^\d/.test(part) ? (
            <span key={index} className="font-medium text-[#d4d9ff]">
                {part}
            </span>
        ) : (
            <span key={index}>{part}</span>
        ),
    );
}
