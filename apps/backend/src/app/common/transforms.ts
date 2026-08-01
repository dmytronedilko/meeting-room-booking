/**
 * class-transformer helpers for DTO fields. They run before class-validator,
 * so validators such as @IsNotEmpty and @Length see the normalized value.
 */

interface TransformParams {
  value: unknown;
}

/** Trims string values; leaves everything else for the validators to reject. */
export function trimString({ value }: TransformParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Normalizes emails: trims edge whitespace and lowercases. */
export function normalizeEmail({ value }: TransformParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
