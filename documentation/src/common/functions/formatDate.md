# `src/common/functions/formatDate.ts`

## Role

Parses **DD/MM/YYYY** date strings into JavaScript `Date` objects (reformatted internally as `YYYY-MM-DD`).

## Function

| Name | Description |
|------|-------------|
| `formatDate(dateString: string): Date \| null` | Splits on `/`; validates parts; returns `Date` or null if format invalid; throws if empty input or invalid parse. |

## Usage

Used by verification flows (e.g. Signzy DL/RC dates) where APIs return dates in dd/mm/yyyy form.
