/**
 * License-band seat extrapolation from `consolidated_use_cases`.
 */

import { getDb } from "../shared/init";
import type { SeatExtrapolationRow } from "../../experience-shared";
import {
  BAND_LOWER_SQL,
  BAND_MIDPOINT_SQL,
  BAND_UPPER_SQL,
} from "./bands";

/**
 * Per-agency seat extrapolation, using ALL consolidated_use_cases rows that
 * have a license band — not just LLM/GenAI rows. Most agencies' bands cover
 * a mix of LLM + classical-ML + computer-vision tools; the consolidated form
 * doesn't reliably distinguish them. Report as a workforce-AI seat estimate,
 * not an LLM-specific one.
 */
export function getSeatExtrapolationByAgency(): SeatExtrapolationRow[] {
  return getDb()
    .prepare<[], SeatExtrapolationRow>(`
      SELECT a.id            AS agency_id,
             a.abbreviation  AS abbreviation,
             a.name          AS name,
             COUNT(*)        AS rows_with_band,
             SUM(${BAND_LOWER_SQL})   AS lower_bound,
             SUM(${BAND_MIDPOINT_SQL}) AS midpoint,
             SUM(${BAND_UPPER_SQL})   AS upper_bound
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.estimated_licenses_users IS NOT NULL
         AND c.estimated_licenses_users != ''
       GROUP BY a.id
       ORDER BY midpoint DESC
    `)
    .all();
}
