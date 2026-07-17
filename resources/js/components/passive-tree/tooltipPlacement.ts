/**
 * Pure placement maths for the node tooltip: keep it inside the stage whether it
 * follows the cursor (desktop hover) or pins to a node (touch tap / the
 * attribute picker).
 */

/** The measured tooltip and the stage it must stay inside, in pixels. */
export interface TooltipBox {
    w: number;
    h: number;
}

export interface TooltipPlacement {
    left: number;
    top: number;
}

const MARGIN = 8;
const ANCHOR_GAP = 14;
const POINTER_OFFSET = 18;

/** Clamp a position so `size` fits inside `extent` with the standard margin. */
export function clampPos(value: number, size: number, extent: number): number {
    return Math.max(
        MARGIN,
        Math.min(value, Math.max(MARGIN, extent - size - MARGIN)),
    );
}

/**
 * Place the tooltip and clamp it to the stage. Anchored (touch / picker): pin
 * above the node, flipping below when there's no room. Cursor (desktop hover):
 * offset from the pointer, flipping side/edge before it would spill out.
 */
export function placeTooltip(args: {
    tip: TooltipBox;
    stage: TooltipBox;
    pointer: { x: number; y: number };
    anchor?: { x: number; y: number };
}): TooltipPlacement {
    const { tip, stage, pointer, anchor } = args;

    if (anchor) {
        const left = clampPos(anchor.x - tip.w / 2, tip.w, stage.w);
        const above = anchor.y - ANCHOR_GAP - tip.h;
        const top = clampPos(
            above >= MARGIN ? above : anchor.y + ANCHOR_GAP,
            tip.h,
            stage.h,
        );

        return { left, top };
    }

    let left =
        pointer.x + POINTER_OFFSET + tip.w > stage.w - MARGIN
            ? pointer.x - POINTER_OFFSET - tip.w
            : pointer.x + POINTER_OFFSET;
    let top =
        pointer.y + POINTER_OFFSET + tip.h > stage.h - MARGIN
            ? pointer.y - POINTER_OFFSET - tip.h
            : pointer.y + POINTER_OFFSET;
    left = clampPos(left, tip.w, stage.w);
    top = clampPos(top, tip.h, stage.h);

    return { left, top };
}
