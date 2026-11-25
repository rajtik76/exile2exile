import { usePage } from '@inertiajs/react';

export interface GameVersion {
    era: string | null;
    name: string | null;
}

export function useLiveGameVersion(): GameVersion {
    const { props } = usePage();

    return {
        era: typeof props.gameEra === 'string' ? props.gameEra : null,
        name: typeof props.gameEraName === 'string' ? props.gameEraName : null,
    };
}

export function gameVersionLabel({ era, name }: GameVersion): string | null {
    if (era === null) {
        return null;
    }

    return name ? `PoE2 ${era} · ${name}` : `PoE2 ${era}`;
}

export function versionedEyebrow(label: string, version: GameVersion): string {
    const suffix = gameVersionLabel(version);

    return suffix === null ? label : `${label} · ${suffix}`;
}

/** The game version a tree is made for; the live one unless `version` is given. */
export function GameVersionBadge({
    version,
    className = '',
}: {
    version?: GameVersion;
    className?: string;
}) {
    const live = useLiveGameVersion();
    const label = gameVersionLabel(version ?? live);

    if (label === null) {
        return null;
    }

    return (
        <span
            className={`font-label text-[15px] tracking-[0.06em] whitespace-nowrap text-pewter-300 ${className}`}
        >
            {label}
        </span>
    );
}
