<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Named queues consumed by the worker. Any worker must be started with
 * --queue=default,mail (see the composer "dev" script and the production
 * worker config), otherwise jobs pushed to a named queue sit unprocessed.
 */
enum Queue: string
{
    case Mail = 'mail';
}
