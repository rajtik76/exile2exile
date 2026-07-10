/** Immutably move an array item from one index to another. */
export function arrayMove<T>(list: T[], from: number, to: number): T[] {
    if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= list.length ||
        to >= list.length
    ) {
        return list;
    }

    const next = list.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    return next;
}

/** Immutably move the item identified by `fromId` to the slot held by `toId`. */
export function moveById<T>(
    list: T[],
    idOf: (item: T) => string,
    fromId: string,
    toId: string,
): T[] {
    return arrayMove(
        list,
        list.findIndex((item) => idOf(item) === fromId),
        list.findIndex((item) => idOf(item) === toId),
    );
}
