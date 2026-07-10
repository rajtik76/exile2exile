<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PatchRelease extends Model
{
    /** @var list<string> */
    protected $fillable = ['version'];
}
