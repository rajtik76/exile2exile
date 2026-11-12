import { expect, test } from 'vitest';
import {
    gameVersionLabel,
    versionedEyebrow,
} from '@/components/build/GameVersion';

test('labels a version with its name when it has one', () => {
    expect(
        gameVersionLabel({ era: '0.5', name: 'Return of the Ancients' }),
    ).toBe('PoE2 0.5 · Return of the Ancients');
    expect(gameVersionLabel({ era: '0.4', name: null })).toBe('PoE2 0.4');
    expect(gameVersionLabel({ era: null, name: null })).toBeNull();
});

test('appends the version to an eyebrow only when it is known', () => {
    expect(versionedEyebrow('Build guide', { era: '0.4', name: null })).toBe(
        'Build guide · PoE2 0.4',
    );
    expect(versionedEyebrow('Build guide', { era: null, name: null })).toBe(
        'Build guide',
    );
});
