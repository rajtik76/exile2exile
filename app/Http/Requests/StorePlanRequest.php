<?php

declare(strict_types=1);

namespace App\Http\Requests;

/**
 * Validates a brand-new build plan. All the work lives in {@see PlanRequest}; a
 * fresh plan carries no edit token yet - the store action mints slug and token.
 */
class StorePlanRequest extends PlanRequest {}
