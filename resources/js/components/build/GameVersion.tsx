import { usePage } from '@inertiajs/react';
import { INPUT_FONT } from '@/components/passive-tree/chrome';

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
            className={`inline-flex items-center self-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap text-[#b39a64] uppercase ${className}`}
            style={{ border: '1px solid rgba(169,132,47,0.35)', ...INPUT_FONT }}
        >
            {label}
        </span>
    );
}
