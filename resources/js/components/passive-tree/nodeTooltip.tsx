import type {
    JewelInfo,
    NodeKind,
    NodeOption,
    TreeNode,
} from '@poe2-toolkit/tree-core';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    ModLines,
    NOTABLE_TITLE_COLOR,
    TooltipCard,
} from '@/components/build/tooltip';
import type { TooltipRarityFrame } from '@/components/build/tooltip';
import { placeTooltip } from './tooltipPlacement';

/**
 * Which carved GGPK banner a node's own tooltip draws, mirroring the game's own
 * tree tooltip exactly (pixel-checked against real screenshots, not poe2db's
 * CSS alone - that CSS turned out to reference unused art for the ascendancy
 * case). A keystone gets its own more ornate banner; every other kind - plain,
 * mastery, jewel, attribute, class/ascendancy start - falls back to the plain
 * `normal` banner, which is the game's own behaviour (none of them carve their
 * own distinct art). An ascendancy notable reuses the plain notable banner too.
 */
const NODE_FRAME: Record<NodeKind, TooltipRarityFrame> = {
    normal: 'normal',
    notable: 'notable',
    keystone: 'keystone',
    mastery: 'normal',
    jewel: 'normal',
    attribute: 'normal',
    classStart: 'normal',
    ascendancyStart: 'normal',
    ascendancyNormal: 'normal',
    ascendancyNotable: 'notable',
};

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

/** Same accent for every node kind - the game's own tree tooltip always titles in this cream, whatever the node. */
const NODE_ACCENT = {
    text: NOTABLE_TITLE_COLOR,
    edge: NOTABLE_TITLE_COLOR,
    glow: 'rgba(249,230,202,0.28)',
};

/**
 * Node tooltip built from the shared {@link TooltipCard} - the same carved GGPK
 * banner and text styling as every other tooltip in the app, keyed to the
 * node's kind (see {@link NODE_FRAME}). Follows the cursor, or pins above a
 * node when a picker is anchored to it.
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
    }, [
        node,
        attributeOption,
        anchor,
        pointer.x,
        pointer.y,
        width,
        height,
        pick,
        jewel,
    ]);

    const { left, top } = placeTooltip({
        tip,
        stage: { w: width, h: height },
        pointer,
        anchor,
    });

    // Capped to the *stage*, not the viewport - this tooltip is `position:
    // absolute` inside the stage, which on a phone can be narrower than the
    // viewport (page chrome around it), so a `vw`-based max-width doesn't
    // know its real ceiling and can render wider than the stage - and the
    // page - even after clampPos above pins it flush to the left edge.
    // Falls back to a viewport-relative cap for the one frame before the
    // stage is measured (width === 0); invisible either way (see opacity).
    const maxWidth = width > 0 ? Math.min(672, width * 0.92) : undefined;

    // Hidden until measured, so it never flashes at an unclamped position.
    const style: CSSProperties = {
        left,
        top,
        opacity: tip.w ? 1 : 0,
        maxWidth,
    };

    // left/top are computed (and clamped) above, so no translate is needed.
    // TooltipCard draws its own shadow, so none is added here.
    const base =
        'pointer-events-none absolute z-20 w-max max-w-[92vw] transition-opacity duration-75';

    return (
        <div ref={tipRef} className={base} style={style}>
            <TooltipCard
                accent={NODE_ACCENT}
                title={node.name || `#${node.skill}`}
                frame={NODE_FRAME[kind]}
            >
                {/* TooltipCard centres its body by default (matching every other
                    tooltip) - the game's own tree tooltip left-aligns the mod/flavour
                    text specifically, so it's overridden just here; the title above,
                    and the jewel/picker/allocated sections below, stay centred. */}
                <div className="text-left">
                    {stats.length > 0 && <ModLines lines={stats} />}

                    {node.flavourText && (
                        <p className="mt-1.5 text-[#9a8b6e] italic">
                            {node.flavourText}
                        </p>
                    )}
                </div>

                {jewel && (
                    <div className="mt-1.5">
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
                            style={{
                                color: RARITY_TEXT[jewel.rarity] ?? '#d6d6d6',
                            }}
                        >
                            {jewel.name || jewel.baseType}
                        </div>
                        {jewel.name &&
                            jewel.baseType &&
                            jewel.name !== jewel.baseType && (
                                <div className="text-[#9a8b6e]">
                                    {jewel.baseType}
                                </div>
                            )}
                        {jewel.mods.length > 0 && (
                            <div className="mt-1.5">
                                <ModLines lines={jewel.mods} />
                            </div>
                        )}
                    </div>
                )}

                {pick ? (
                    <div className="mt-1.5" style={{ pointerEvents: 'none' }}>
                        <div className="pointer-events-auto flex flex-col gap-1.5">
                            {ATTRIBUTE_PICKS.map((option) => {
                                const active =
                                    (pick.value ?? 'any') === option.key;
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
                        <div className="mt-1.5 text-xs tracking-[0.16em] text-[#6f9f8f] uppercase">
                            Allocated
                        </div>
                    )
                )}
            </TooltipCard>
        </div>
    );
}
