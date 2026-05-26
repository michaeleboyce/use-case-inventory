import {
  getAgencyToolMatrix,
  getGenAiHeadlines,
  getGenAiTimeline,
  getOmbIfpCrosstab,
  getSeatExtrapolationByAgency,
  getYearCompareGenAi,
} from "@/lib/db";

export async function buildExperienceViewModel() {
  const headlines = getGenAiHeadlines();
  const crosstab = getOmbIfpCrosstab();
  const timeline = getGenAiTimeline();
  const seats = getSeatExtrapolationByAgency();
  const matrix = getAgencyToolMatrix();
  const yearCompare = getYearCompareGenAi();

  const totalSeatsMidpoint = seats.reduce((a, r) => a + r.midpoint, 0);
  const totalSeatsLower = seats.reduce((a, r) => a + r.lower_bound, 0);
  const totalSeatsUpper = seats.reduce((a, r) => a + r.upper_bound, 0);

  return {
    headlines,
    crosstab,
    timeline,
    seats,
    matrix,
    yearCompare,
    totalSeatsMidpoint,
    totalSeatsLower,
    totalSeatsUpper,
  };
}

export type ExperienceViewModel = Awaited<
  ReturnType<typeof buildExperienceViewModel>
>;
