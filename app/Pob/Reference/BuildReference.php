<?php

declare(strict_types=1);

namespace App\Pob\Reference;

/**
 * The current league's reference data, as slim lookup sets used to decide whether
 * a build is compatible: which passive nodes and which gems actually exist.
 */
interface BuildReference
{
    /**
     * Set of valid passive node ids (value `true`), keyed by node id.
     *
     * @return array<int, true>
     */
    public function passiveNodeIds(): array;

    /**
     * Set of valid gem ids (value `true`), keyed by the gem's stable id (the
     * final segment of its metadata path, e.g. "SkillGemFragmentationRounds").
     *
     * @return array<string, true>
     */
    public function gemIds(): array;
}
