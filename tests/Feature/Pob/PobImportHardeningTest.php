<?php

declare(strict_types=1);

use App\Pob\PobImport;

it('rejects an over-sized PoB code before decoding', function () {
    $import = new PobImport;

    expect(fn () => $import->decode(str_repeat('A', PobImport::MAX_CODE_BYTES + 1)))
        ->toThrow(InvalidArgumentException::class);
});

it('rejects a zlib bomb that inflates past the decoded cap', function () {
    $import = new PobImport;

    // A tiny code whose zlib payload inflates past the cap - a textbook zlib bomb.
    $bomb = strtr(base64_encode(gzcompress(str_repeat('A', PobImport::MAX_DECODED_BYTES + 1_000_000))), '+/', '-_');

    expect(strlen($bomb))->toBeLessThan(PobImport::MAX_CODE_BYTES);
    expect(fn () => $import->decode($bomb))->toThrow(InvalidArgumentException::class);
});

it('fails gracefully on an export with no passive-tree spec', function () {
    $import = new PobImport;
    $xml = '<?xml version="1.0"?><PathOfBuilding2><Build level="1" className="Warrior"/></PathOfBuilding2>';

    // Was a raw TypeError out of activeSpec(); now a deliberate InvalidArgumentException.
    expect(fn () => $import->fromXml($xml))->toThrow(InvalidArgumentException::class);
});

it('drops item flag lines (Corrupted, Mirrored) from the parsed mods', function () {
    $import = new PobImport;
    $xml = '<?xml version="1.0"?><PathOfBuilding2>'
        .'<Build level="1" className="Warrior"/>'
        .'<Tree activeSpec="1"><Spec classId="0" treeVersion="x" nodes=""/></Tree>'
        .'<Skills activeSkillSet="1"><SkillSet id="1"/></Skills>'
        .'<Items activeItemSet="1"><Item id="1">Rarity: RARE'."\n"
        .'Doom Band'."\n"
        .'Iron Ring'."\n"
        .'Item Level: 80'."\n"
        .'Implicits: 1'."\n"
        .'+8 to maximum Life'."\n"
        .'+15 to Strength'."\n"
        .'Corrupted'."\n"
        .'Mirrored</Item>'
        .'<ItemSet id="1"><Slot name="Ring 1" itemId="1"/></ItemSet></Items>'
        .'</PathOfBuilding2>';

    $item = $import->fromXml($xml)->items[0];

    // The flags are trailing, so implicit counting stays intact: one implicit line,
    // one explicit line, and neither flag survives as a modifier.
    expect($item->mods)->toBe(['+8 to maximum Life', '+15 to Strength'])
        ->and($item->explicitMods())->toBe(['+15 to Strength']);
});

it('does not resolve external entities (XXE) when parsing an export', function () {
    $import = new PobImport;
    $secret = tempnam(sys_get_temp_dir(), 'xxe');
    file_put_contents($secret, 'TOP-SECRET-XXE');

    $xml = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file://'.$secret.'">]>'
        .'<PathOfBuilding2><Build level="1" className="Warrior" ascendClassName="&xxe;"/>'
        .'<Tree activeSpec="1"><Spec classId="0" treeVersion="x" nodes=""/></Tree></PathOfBuilding2>';

    try {
        $snapshot = $import->fromXml($xml);
        // Parsed, but the entity must never have been expanded to the file's contents.
        expect(json_encode($snapshot->toArray()))->not->toContain('TOP-SECRET-XXE');
    } catch (InvalidArgumentException) {
        // Rejecting the document outright is also acceptable.
        expect(true)->toBeTrue();
    } finally {
        @unlink($secret);
    }
});
