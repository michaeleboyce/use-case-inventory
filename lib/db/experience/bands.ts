/**
 * License-band conversion helpers shared by the seat-extrapolation and
 * agency-tool-matrix modules.
 *
 * Band midpoints convert the free-text license bands on
 * `consolidated_use_cases.estimated_licenses_users` into integer seat
 * estimates. These are the midpoints of each OMB-defined band; "50,000+"
 * gets a 75k midpoint as a conservative estimate (the largest civilian
 * agencies top out around 250k staff, but most '50,000+' rows are at the
 * lower end).
 */

export const BAND_MIDPOINT_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 50
    WHEN '101-1000'      THEN 550
    WHEN '1001-5000'     THEN 3000
    WHEN '5001-10,000'   THEN 7500
    WHEN '10,000-50,000' THEN 30000
    WHEN '50,000+'       THEN 75000
    ELSE 0
  END
`;

export const BAND_LOWER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 1
    WHEN '101-1000'      THEN 101
    WHEN '1001-5000'     THEN 1001
    WHEN '5001-10,000'   THEN 5001
    WHEN '10,000-50,000' THEN 10000
    WHEN '50,000+'       THEN 50000
    ELSE 0
  END
`;

export const BAND_UPPER_SQL = `
  CASE c.estimated_licenses_users
    WHEN '1-100'         THEN 100
    WHEN '101-1000'      THEN 1000
    WHEN '1001-5000'     THEN 5000
    WHEN '5001-10,000'   THEN 10000
    WHEN '10,000-50,000' THEN 50000
    WHEN '50,000+'       THEN 100000
    ELSE 0
  END
`;

/** TS mirror of BAND_UPPER_SQL — used to re-sort entries inside a cell. */
export function bandUpper(band: string | null): number {
  if (band == null) return 0;
  switch (band) {
    case "1-100":
      return 100;
    case "101-1000":
      return 1000;
    case "1001-5000":
      return 5000;
    case "5001-10,000":
      return 10000;
    case "10,000-50,000":
      return 50000;
    case "50,000+":
      return 100000;
    default:
      return 0;
  }
}

export const BAND_UPPER_TO_MIDPOINT = new Map<number, number>([
  [100, 50],
  [1000, 550],
  [5000, 3000],
  [10000, 7500],
  [50000, 30000],
  [100000, 75000],
]);
