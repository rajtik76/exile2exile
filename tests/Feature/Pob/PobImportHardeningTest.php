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
