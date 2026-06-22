export function formatNumber(value: number | undefined, digits: number): string {
  if (value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return '—'
  }

  return value.toFixed(digits)
}

export function formatCredits(value: number | undefined): string {
  return formatNumber(value, 1)
}

export function formatScore(value: number | undefined): string {
  return formatNumber(value, 1)
}

export function formatRequiredScore(value: number | undefined): string {
  return formatNumber(value, 2)
}

export function formatGpa(value: number | undefined): string {
  return formatNumber(value, 2)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function toInputNumber(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value)
}

export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}
