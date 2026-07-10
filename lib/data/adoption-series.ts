// lib/data/adoption-series.ts
//
// External technology-adoption baseline series for the /adoption comparison
// page. These are CHECKED-IN data (not DB-derived): each series carries its
// exact metric definition, population, source URL, and access date, and is
// exported verbatim via /api/adoption-series.csv.
//
// Provenance / reproduction notes:
//   - HTTPS series: computed by IFP from the GSA archived weekly `parents-*.csv`
//     scans (github.com/GSA/https, compliance/m-15-13/data/), downsampled to
//     the first snapshot of each month plus the final 2016-12-31 snapshot.
//     Denominator = live parent .gov domains in that week's scan (~1,130-1,190).
//     "Supports" = Valid HTTPS and not Downgrades HTTPS; "Enforces" = Defaults
//     to HTTPS or Strictly Forces HTTPS (the archived Pulse definitions).
//   - Workplace-PC series: Census CPS computer-use supplement points as
//     reported in Census/BLS publications; pre-1993 points are rounded as
//     published in summary tables.
//   - PIV series: discrete datapoints hand-assembled from OMB FISMA reports
//     and White House Cybersecurity Sprint reporting; metric definitions vary
//     slightly across reports (see note).
//   - OWID household series: Our World in Data "Technology adoption in US
//     households" grapher CSV (Comin & Hobijn HCCTAD + Horace Dediu), CC BY.
//
// Annual survey observations are dated July 1 of the survey year by
// convention (see AdoptionPoint.date).

import type { AdoptionSeries } from "@/lib/types/adoption";

const OWID_SOURCE = {
  title: "Our World in Data — Technology adoption in US households",
  url: "https://ourworldindata.org/grapher/technology-adoption-by-households-in-the-united-states",
  accessed: "2026-07-06",
  note: "Underlying data: Comin & Hobijn (2004) HCCTAD and Horace Dediu. CC BY.",
};

const yr = (year: number, value: number) => ({
  date: `${year}-07-01`,
  value,
});

export const ADOPTION_SERIES: AdoptionSeries[] = [
  {
    id: "https-enforces",
    label: "Federal HTTPS — enforced",
    population: "Live parent .gov domains, executive branch",
    metric:
      "Share of live parent .gov domains that default to or strictly force HTTPS",
    unit: "percent",
    start: { date: "2015-06-08", label: "OMB M-15-13 HTTPS-Only Standard" },
    introduced: { date: "1994-10-15", label: "HTTPS in commercial use (Netscape SSL, \u22481994)" },
    driver: "federal mandate",
    source: {
      title: "GSA archived Pulse HTTPS scans (weekly parents-*.csv)",
      url: "https://github.com/GSA/https/tree/master/compliance/m-15-13/data",
      accessed: "2026-07-06",
      note: "Computed by IFP from the raw weekly scans; monthly downsample.",
    },
    points: [
      { date: "2015-06-13", value: 16.8 },
      { date: "2015-07-03", value: 17.9 },
      { date: "2015-08-07", value: 19.8 },
      { date: "2015-09-04", value: 21.2 },
      { date: "2015-10-09", value: 22.2 },
      { date: "2015-11-06", value: 24.0 },
      { date: "2015-12-04", value: 24.7 },
      { date: "2016-01-02", value: 26.1 },
      { date: "2016-02-04", value: 28.6 },
      { date: "2016-03-03", value: 32.9 },
      { date: "2016-04-01", value: 31.4 },
      { date: "2016-05-06", value: 34.8 },
      { date: "2016-06-03", value: 36.0 },
      { date: "2016-07-05", value: 37.7 },
      { date: "2016-08-05", value: 41.5 },
      { date: "2016-09-02", value: 43.0 },
      { date: "2016-10-03", value: 46.8 },
      { date: "2016-11-04", value: 49.6 },
      { date: "2016-12-02", value: 51.9 },
      { date: "2016-12-31", value: 65.5 },
    ],
  },
  {
    id: "https-supports",
    label: "Federal HTTPS — supported",
    population: "Live parent .gov domains, executive branch",
    metric:
      "Share of live parent .gov domains with valid HTTPS that does not downgrade",
    unit: "percent",
    start: { date: "2015-06-08", label: "OMB M-15-13 HTTPS-Only Standard" },
    introduced: { date: "1994-10-15", label: "HTTPS in commercial use (Netscape SSL, \u22481994)" },
    driver: "federal mandate",
    source: {
      title: "GSA archived Pulse HTTPS scans (weekly parents-*.csv)",
      url: "https://github.com/GSA/https/tree/master/compliance/m-15-13/data",
      accessed: "2026-07-06",
      note: "Computed by IFP from the raw weekly scans; monthly downsample.",
    },
    points: [
      { date: "2015-06-13", value: 24.5 },
      { date: "2015-07-03", value: 24.5 },
      { date: "2015-08-07", value: 25.2 },
      { date: "2015-09-04", value: 26.8 },
      { date: "2015-10-09", value: 28.6 },
      { date: "2015-11-06", value: 29.8 },
      { date: "2015-12-04", value: 31.6 },
      { date: "2016-01-02", value: 32.7 },
      { date: "2016-02-04", value: 35.5 },
      { date: "2016-03-03", value: 37.1 },
      { date: "2016-04-01", value: 37.8 },
      { date: "2016-05-06", value: 39.4 },
      { date: "2016-06-03", value: 42.5 },
      { date: "2016-07-05", value: 44.1 },
      { date: "2016-08-05", value: 46.8 },
      { date: "2016-09-02", value: 49.6 },
      { date: "2016-10-03", value: 52.1 },
      { date: "2016-11-04", value: 56.5 },
      { date: "2016-12-02", value: 60.4 },
      { date: "2016-12-31", value: 67.0 },
    ],
  },
  {
    id: "workplace-pc",
    label: "Computer use at work",
    population: "Employed US adults (18+)",
    metric: "Share of employed adults who use a computer at work",
    unit: "percent",
    start: { date: "1981-08-12", label: "IBM PC introduced (organic — no mandate)" },
    driver: "organic",
    source: {
      title:
        "Census CPS computer-use supplements / BLS “Computer and Internet Use at Work in 2003”",
      url: "https://www.bls.gov/news.release/pdf/ciuaw.pdf",
      accessed: "2026-07-06",
      note: "1984/1989/2001 points rounded as published in Census summary tables (P23-208; Kominski 1999).",
    },
    points: [
      { ...yr(1984, 25), approx: true },
      { ...yr(1989, 37), approx: true },
      yr(1993, 45.8),
      yr(1997, 49.4),
      { ...yr(2001, 54), approx: true },
      yr(2003, 56.1),
    ],
  },
  {
    id: "piv-login",
    label: "Federal strong-auth login (PIV)",
    population: "Federal civilian CFO Act agency users",
    metric:
      "Share of users required to authenticate with strong (PIV) credentials",
    unit: "percent",
    start: { date: "2004-08-27", label: "HSPD-12 PIV mandate" },
    introduced: { date: "1995-06-30", label: "smart-card credentials in commercial use (\u2248mid-1990s)" },
    driver: "federal mandate",
    source: {
      title:
        "OMB FISMA annual reports & 2015 Cybersecurity Sprint results (White House)",
      url: "https://obamawhitehouse.archives.gov/blog/2015/07/31/strengthening-enhancing-federal-cybersecurity-21st-century",
      accessed: "2026-07-06",
      note: "Hand-assembled datapoints; metric definitions vary slightly across OMB reports (PIV login vs strong auth). FY2015 FISMA report: 81% by 2015-11-16.",
    },
    points: [
      { date: "2010-09-30", value: 1.24 },
      { date: "2013-09-30", value: 20, approx: true },
      { date: "2015-04-30", value: 42 },
      { date: "2015-07-31", value: 72 },
      { date: "2015-11-16", value: 81 },
    ],
  },
  {
    id: "fedramp-authorizations",
    label: "FedRAMP-authorized cloud services",
    population: "Cloud service offerings, government-wide",
    metric: "Cumulative FedRAMP authorizations",
    unit: "count",
    start: { date: "2011-12-08", label: "FedRAMP policy memo (post Cloud First, 2010-12-09)" },
    driver: "federal mandate",
    source: {
      title: "FedRAMP.gov milestone announcements & marketplace",
      url: "https://www.fedramp.gov/",
      accessed: "2026-07-06",
      note: "Milestone datapoints: ~20 by 2016; 100 by 2018; 200 by Sept 2020 (fedramp.gov); <350 by 2024, 502 by early 2026 (MeriTalk).",
    },
    points: [
      { date: "2016-12-31", value: 20, approx: true },
      { date: "2018-12-31", value: 100, approx: true },
      { date: "2020-09-30", value: 200 },
      { date: "2024-09-30", value: 350, approx: true },
      { date: "2026-01-31", value: 502 },
    ],
  },
  // ---- Household context curves (different population — render as context,
  // ---- never on the same visual footing as the federal series). Source: OWID.
  {
    id: "owid-computer",
    label: "Computer (US households)",
    population: "US households",
    metric: "Share of US households with a computer",
    unit: "percent",
    start: { date: "1981-08-12", label: "IBM PC introduced" },
    driver: "organic",
    source: OWID_SOURCE,
    points: [
      yr(1992, 20.7), yr(1998, 42.0), yr(2003, 63.1), yr(2005, 67.1),
      yr(2010, 75.2), yr(2011, 76.7), yr(2012, 78.9), yr(2013, 83.8),
      yr(2014, 85.1), yr(2015, 86.8), yr(2016, 89.3),
    ],
  },
  {
    id: "owid-internet",
    label: "Internet (US households)",
    population: "US households",
    metric: "Share of US households with internet access",
    unit: "percent",
    start: { date: "1991-08-06", label: "Public World Wide Web" },
    driver: "organic",
    source: OWID_SOURCE,
    points: [
      yr(1993, 10), yr(1994, 11), yr(1995, 13), yr(1996, 16), yr(1997, 19),
      yr(1998, 25), yr(1999, 34), yr(2000, 42), yr(2001, 49), yr(2002, 52),
      yr(2003, 54), yr(2004, 57), yr(2005, 61), yr(2006, 62), yr(2007, 65),
      yr(2008, 68), yr(2009, 70), yr(2010, 74), yr(2011, 76), yr(2012, 81),
      yr(2013, 82), yr(2014, 83), yr(2015, 85), yr(2016, 88),
    ],
  },
  {
    id: "owid-smartphone",
    label: "Smartphone (US households)",
    population: "US households",
    metric: "Share of US households using a smartphone",
    unit: "percent",
    start: { date: "2007-06-29", label: "iPhone introduced" },
    driver: "organic",
    source: OWID_SOURCE,
    points: [
      yr(2011, 35), yr(2012, 45), yr(2013, 54), yr(2014, 57), yr(2015, 68),
      yr(2016, 73), yr(2017, 73), yr(2018, 77), yr(2019, 81),
    ],
  },
];

export function getAdoptionSeries(id: string): AdoptionSeries | undefined {
  return ADOPTION_SERIES.find((s) => s.id === id);
}
