import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Lifter, Attempt, LiftType, AttemptStatus, CompetitionMode } from "@/lib/types";

// ════════════════════════════════════════════════════════════════════════════════
// GL Points calculation — uses same formula as App.tsx (calculateGoodliftPoints)
// ════════════════════════════════════════════════════════════════════════════════════════════════

const GL_COEFFICIENTS: Record<string, { a: number; b: number; c: number }> = {
  "Male Classic Raw": { a: 1199.72839, b: 1025.18162, c: 0.00921 },
  "Female Classic Raw": { a: 610.32796, b: 1045.59282, c: 0.03048 },
  "Male Equipped": { a: 1236.25115, b: 1449.21864, c: 0.01644 },
  "Female Equipped": { a: 758.63871, b: 949.31382, c: 0.02435 },
  "Male Classic Raw Bench": { a: 320.98041, b: 281.40258, c: 0.01008 },
  "Female Classic Raw Bench": { a: 142.40398, b: 442.52671, c: 0.04724 },
  "Male Equipped Bench": { a: 381.22073, b: 733.79378, c: 0.02398 },
  "Female Equipped Bench": { a: 221.09511, b: 596.24238, c: 0.04137 },
};

function getGLCoefficientSet(
  sex: "Male" | "Female",
  equipped: boolean,
  benchOnly: boolean,
): { a: number; b: number; c: number } {
  const eq = equipped ? "Equipped" : "Classic Raw";
  const lift = benchOnly ? " Bench" : "";
  const key = `${sex} ${eq}${lift}` as keyof typeof GL_COEFFICIENTS;
  return GL_COEFFICIENTS[key] ?? GL_COEFFICIENTS["Male Classic Raw"];
}

function calculateGLPoints(
  totalKg: number,
  bodyweight: number | "",
  sex: "Male" | "Female",
  equipped: boolean,
  benchOnly: boolean,
): number {
  if (!(typeof bodyweight === "number" && Number.isFinite(bodyweight) && bodyweight > 0)) return 0;
  if (!(Number.isFinite(totalKg) && totalKg > 0)) return 0;
  const { a, b, c } = getGLCoefficientSet(sex, equipped, benchOnly);
  const denominator = a - b * Math.exp(-c * bodyweight);
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((totalKg * 100) / denominator).toFixed(2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Category header color mapping (matches the screenshot exactly)
// ═══════════════════════════════════════════════════════════════════════════════
// Ordered most-specific first so `includes` matches correctly.
const CATEGORY_COLORS: Array<[string, { bg: string; text: string; border: string }]> = [
  ["SUB JUNIOR",   { bg: "#00C853", text: "#ffffff", border: "#00C853" }],
  ["SUB-JUNIOR",   { bg: "#00C853", text: "#ffffff", border: "#00C853" }],
  ["MASTERS 1",    { bg: "#8E24AA", text: "#ffffff", border: "#8E24AA" }],
  ["MASTERS 2",    { bg: "#D32F2F", text: "#ffffff", border: "#D32F2F" }],
  ["MASTERS 3",    { bg: "#6D4C41", text: "#ffffff", border: "#6D4C41" }],
  ["MASTER 1",     { bg: "#8E24AA", text: "#ffffff", border: "#8E24AA" }],
  ["MASTER 2",     { bg: "#D32F2F", text: "#ffffff", border: "#D32F2F" }],
  ["MASTER 3",     { bg: "#6D4C41", text: "#ffffff", border: "#6D4C41" }],
  ["MASTERS",      { bg: "#8E24AA", text: "#ffffff", border: "#8E24AA" }],
  ["MASTER",       { bg: "#8E24AA", text: "#ffffff", border: "#8E24AA" }],
  ["JUNIOR",       { bg: "#1565C0", text: "#ffffff", border: "#1565C0" }],
  ["SENIOR",       { bg: "#FB8C00", text: "#ffffff", border: "#FB8C00" }],
  ["OVERALL",      { bg: "#263238", text: "#ffffff", border: "#263238" }],
  ["OPEN",         { bg: "#263238", text: "#ffffff", border: "#263238" }],
];

function getCategoryColor(categoryName: string) {
  const upper = categoryName.toUpperCase();
  for (const [key, colors] of CATEGORY_COLORS) {
    if (upper.includes(key)) return colors;
  }
  return { bg: "#263238", text: "#ffffff", border: "#263238" };
}

function parseCategoryParts(categoryName: string): {
  category: string;
  sex: string;
  federation: string;
  weightRange: string;
} {
  const upper = categoryName.toUpperCase();
  const category = categoryName;
  let sex = "MEN";
  const federation = "";
  let weightRange = "";

  if (upper.includes("WOMEN") || upper.includes("FEMALE")) sex = "WOMEN";
  else if (upper.includes("MEN") || upper.includes("MALE")) sex = "MEN";

  const weightMatch = categoryName.match(/(\d+(?:\.\d+)?)\s*[-\u2013\u2014]\s*(\d+(?:\.\d+)?)\s*(?:kg|KG)/i);
  if (weightMatch) {
    weightRange = `${weightMatch[1]} – ${weightMatch[2]} KG`;
  }

  return { category, sex, federation, weightRange };
}

// Official IPF weight-class order (lightest to heaviest, SHW last)
const MEN_WC_ORDER = ["53", "59", "66", "74", "83", "93", "105", "120", "120+"];
const WOMEN_WC_ORDER = ["43", "47", "52", "57", "63", "69", "76", "84", "84+"];

function normalizeWeightClassKey(wc: string): string {
  // "59kg" -> "59", "120kg+" -> "120+", "43kg (Sub/Jr)" -> "43", "SHW" -> "120+"/"84+"
  const m = wc.match(/(\d+(?:\.\d+)?)\s*kg\s*(\+?)/i);
  if (m) return `${m[1]}${m[2] || ""}`;
  const plain = wc.match(/^(\d+(?:\.\d+)?)(\+?)$/);
  if (plain) return `${plain[1]}${plain[2] || ""}`;
  return wc.trim();
}

function getWeightClassOrder(sex: "Male" | "Female" | string, wcKey: string): number {
  const list = sex === "Female" || String(sex).toUpperCase().startsWith("F") ? WOMEN_WC_ORDER : MEN_WC_ORDER;
  const idx = list.indexOf(wcKey);
  return idx === -1 ? 999 : idx;
}

function formatWeightClassLabel(wcKey: string): string {
  if (!wcKey) return "";
  return wcKey.endsWith("+") ? `${wcKey.slice(0, -1)}+ KG` : `${wcKey} KG`;
}

function formatDivisionLabel(category: string, sex: string): string {
  const upper = category.toUpperCase();
  let division = "SENIOR";
  if (upper.includes("SUB JUNIOR") || upper.includes("SUB-JUNIOR")) division = "SUB-JUNIOR";
  else if (upper.includes("JUNIOR")) division = "JUNIOR";
  else if (upper.includes("MASTER 4")) division = "MASTER 4";
  else if (upper.includes("MASTER 3")) division = "MASTER 3";
  else if (upper.includes("MASTER 2")) division = "MASTER 2";
  else if (upper.includes("MASTER 1")) division = "MASTER 1";
  else if (upper.includes("MASTER")) division = "MASTER";
  else if (upper.includes("SENIOR")) division = "SENIOR";
  return `${division} ${sex}`;
}

function getDivisionOrder(category: string): number {
  const upper = category.toUpperCase();
  if (upper.includes("SUB JUNIOR") || upper.includes("SUB-JUNIOR")) return 0;
  if (upper.includes("JUNIOR")) return 1;
  if (upper.includes("SENIOR")) return 2;
  if (upper.includes("MASTER 1")) return 3;
  if (upper.includes("MASTER 2")) return 4;
  if (upper.includes("MASTER 3")) return 5;
  if (upper.includes("MASTER 4")) return 6;
  if (upper.includes("MASTER")) return 3;
  return 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility helpers
// ═══════════════════════════════════════════════════════════════════════════════
const bestGoodLift = (attempts: Attempt[]): number => {
  return attempts.reduce((best, cur) => {
    if (cur.status !== "GOOD" || cur.weight === "") return best;
    return cur.weight > best ? cur.weight : best;
  }, 0);
};

const resolveAttemptWeight = (lifter: Lifter, lift: LiftType, attemptIndex: number): number => {
  const attempts = lift === "squat" ? lifter.squatAttempts : lift === "bench" ? lifter.benchAttempts : lifter.deadliftAttempts;
  const att = attempts[attemptIndex];
  if (!att || att.weight === "") return 0;
  return att.weight;
};

function getAttemptStyle(status: AttemptStatus, isBenchOnly: boolean): { text: string; className: string } {
  const dash = "\u2013"; // en dash

  if (isBenchOnly) {
    return { text: dash, className: "text-slate-600" };
  }

  switch (status) {
    case "GOOD":
      return { text: "", className: "text-[#22c55e] font-bold" };
    case "NO":
      return { text: "", className: "text-[#ef4444] font-bold line-through decoration-2" };
    case "PENDING":
      return { text: "", className: "text-[#eab308] font-semibold" };
    case "UNATTEMPTED":
    default:
      return { text: dash, className: "text-slate-600" };
  }
}

function formatAttemptCell(attempt: Attempt | undefined, isBenchOnly: boolean): { text: string; className: string } {
  const dash = "\u2013";
  if (!attempt) return { text: dash, className: "text-slate-600" };

  const weight = attempt.weight;
  const status = attempt.status;

  if (isBenchOnly) return { text: dash, className: "text-slate-600" };

  if (weight === "") {
    if (status === "UNATTEMPTED" || status === "PENDING") return { text: dash, className: "text-slate-600" };
    return { text: dash, className: "text-slate-600" };
  }

  const style = getAttemptStyle(status, false);
  return { text: String(weight), className: style.className };
}

function displayDistrictName(team: string): string {
  const parts = team.split(" - ");
  if (parts.length >= 3 && parts[0] === "India") return parts.slice(2).join(" - ");
  return team;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Types for the scoreboard
// ═══════════════════════════════════════════════════════════════════════════════
export type ScoreboardLifter = Lifter & {
  total: number;
  glPoints: number;
};

export type ScoreboardCategory = {
  name: string;
  sex: string;
  federation: string;
  weightRange: string;
  lifters: ScoreboardLifter[];
};

export type ScoreboardData = {
  currentLifter: {
    name: string;
    weight: number;
    lift: LiftType;
    attemptIndex: number;
  } | null;
  nextLifter: {
    name: string;
    weight: number;
  } | null;
  categories: ScoreboardCategory[];
  competitionMode: CompetitionMode;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Font size control
// ═══════════════════════════════════════════════════════════════════════════════
const FONT_SIZE_KEY = "powerlifting.scoreboard.fontSize";
const ZOOM_KEY = "powerlifting.scoreboard.zoom";
const MIN_FONT = 8;
const MAX_FONT = 40;
const DEFAULT_FONT = 13;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;
const TARGET_VISIBLE_ROWS = 24;
const MIN_DENSE_ROW_HEIGHT = 16;
const MAX_DENSE_ROW_HEIGHT = 60;
const MIN_DENSE_FONT = 9;

function useFontSize() {
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_FONT;
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (Number.isFinite(n) && n >= MIN_FONT && n <= MAX_FONT) return n;
    }
    return DEFAULT_FONT;
  });

  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_ZOOM;
    const saved = localStorage.getItem(ZOOM_KEY);
    if (saved) {
      const n = parseFloat(saved);
      if (Number.isFinite(n) && n >= MIN_ZOOM && n <= MAX_ZOOM) return n;
    }
    return DEFAULT_ZOOM;
  });

  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  }, [zoom]);

  const increase = () => setFontSize((s) => Math.min(MAX_FONT, s + 1));
  const decrease = () => setFontSize((s) => Math.max(MIN_FONT, s - 1));
  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100));
  const zoomReset = () => setZoom(DEFAULT_ZOOM);

  return { fontSize, increase, decrease, zoom, zoomIn, zoomOut, zoomReset, showControls, setShowControls };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Live clock
// ═══════════════════════════════════════════════════════════════════════════════
function useLiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data builder from existing Lifter[] (no new API — uses existing state)
// ═══════════════════════════════════════════════════════════════════════════════
function buildScoreboardData(
  lifters: Lifter[],
  currentLifterId: string | null,
  currentLift: LiftType,
  currentAttemptIndex: number,
  nextLifterId: string | null,
  competitionMode: CompetitionMode,
): ScoreboardData {
  const isBenchOnly = competitionMode === "BENCH_ONLY";

  // Scoreboard lifters with totals and GL points
  const scoredLifters: ScoreboardLifter[] = lifters.map((l) => {
    const squat = bestGoodLift(l.squatAttempts);
    const bench = bestGoodLift(l.benchAttempts);
    const deadlift = bestGoodLift(l.deadliftAttempts);
    const total = isBenchOnly ? bench : squat + bench + deadlift;
    const glPoints = calculateGLPoints(total, l.bodyweight, l.sex, l.isEquipped, isBenchOnly);
    return { ...l, total, glPoints };
  });

  // Group by (weightClass, ageDivision). Weight class comes first so display
  // order is lightest → heaviest, then Sub-Junior → Master within it.
  type Bucket = { wcKey: string; sexKey: "Male" | "Female"; category: string; lifters: ScoreboardLifter[] };
  const buckets = new Map<string, Bucket>();
  for (const lifter of scoredLifters) {
    const wcKey = normalizeWeightClassKey(lifter.weightClass || "");
    const rawCategory = (lifter.category || "Unclassified").trim();
    const sexKey: "Male" | "Female" = lifter.sex === "Female" ? "Female" : "Male";
    // Dual-category lifters (e.g. "Junior Men + Senior Men") must appear in BOTH
    // category tables. The same `lifter` reference is pushed into each bucket so
    // attempts, totals, GL points, and placings stay perfectly synchronized —
    // one lift counts for both categories.
    const categoryParts = rawCategory.includes(" + ")
      ? rawCategory.split(" + ").map((p) => p.trim()).filter(Boolean)
      : [rawCategory];
    for (const category of categoryParts) {
      const key = `${sexKey}::${wcKey}::${category}`;
      if (!buckets.has(key)) buckets.set(key, { wcKey, sexKey, category, lifters: [] });
      buckets.get(key)!.lifters.push(lifter);
    }
  }

  const categories: ScoreboardCategory[] = Array.from(buckets.values())
    .map(({ wcKey, sexKey, category, lifters }) => {
      const { sex } = parseCategoryParts(`${category} ${sexKey === "Female" ? "Women" : "Men"}`);
      const divisionLabel = formatDivisionLabel(category, sex);
      const weightLabel = formatWeightClassLabel(wcKey);
      const name = weightLabel ? `${divisionLabel} – ${weightLabel}` : divisionLabel;
      // Rank INDEPENDENTLY within this category using the shared calculated
      // values (same total / GL points as any other category the lifter is in).
      // IPF tiebreak: higher total → lighter bodyweight → earlier lot.
      const sorted = [...lifters].sort((a, b) => {
        const aDq = a.disqualified ? 1 : 0;
        const bDq = b.disqualified ? 1 : 0;
        if (aDq !== bDq) return aDq - bDq;
        const aHas = a.total > 0 ? 0 : 1;
        const bHas = b.total > 0 ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        if (a.total !== b.total) return b.total - a.total;
        const bwA = typeof a.bodyweight === "number" ? a.bodyweight : Infinity;
        const bwB = typeof b.bodyweight === "number" ? b.bodyweight : Infinity;
        if (bwA !== bwB) return bwA - bwB;
        const lotA = typeof a.lot === "number" ? a.lot : Infinity;
        const lotB = typeof b.lot === "number" ? b.lot : Infinity;
        if (lotA !== lotB) return lotA - lotB;
        return a.name.localeCompare(b.name);
      });
      return { name, sex, federation: "", weightRange: weightLabel, lifters: sorted, _wcKey: wcKey, _sexKey: sexKey, _category: category } as ScoreboardCategory & { _wcKey: string; _sexKey: "Male" | "Female"; _category: string };
    })
    .sort((a: any, b: any) => {
      // 1) Sex (Men first, then Women — keep stable grouping)
      if (a._sexKey !== b._sexKey) return a._sexKey === "Male" ? -1 : 1;
      // 2) Official IPF weight-class order (lightest → heaviest, SHW last)
      const wcA = getWeightClassOrder(a._sexKey, a._wcKey);
      const wcB = getWeightClassOrder(b._sexKey, b._wcKey);
      if (wcA !== wcB) return wcA - wcB;
      // 3) Age division order within a weight class
      const dvA = getDivisionOrder(a._category);
      const dvB = getDivisionOrder(b._category);
      if (dvA !== dvB) return dvA - dvB;
      return a.name.localeCompare(b.name);
    });

  const currentLifter = lifters.find((l) => l.id === currentLifterId);
  const nextLifter = lifters.find((l) => l.id === nextLifterId);

  return {
    currentLifter: currentLifter
      ? {
          name: currentLifter.name,
          weight: resolveAttemptWeight(currentLifter, currentLift, currentAttemptIndex),
          lift: currentLift,
          attemptIndex: currentAttemptIndex,
        }
      : null,
    nextLifter: nextLifter
      ? {
          name: nextLifter.name,
          weight: resolveAttemptWeight(nextLifter, currentLift, currentAttemptIndex),
        }
      : null,
    categories,
    competitionMode,
  };
}

function getCategorySortOrder(category: string): number {
  const upper = category.toUpperCase();
  if (upper.includes("SUB JUNIOR")) return 0;
  if (upper.includes("JUNIOR")) return 1;
  if (upper.includes("SENIOR")) return 2;
  if (upper.includes("MASTER 4")) return 6;
  if (upper.includes("MASTER 3")) return 5;
  if (upper.includes("MASTER 2")) return 4;
  if (upper.includes("MASTER 1")) return 3;
  if (upper.includes("MASTER")) return 3;
  return 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
type LiveScoreboardProps = {
  lifters: Lifter[];
  currentLifterId: string | null;
  currentLift: LiftType;
  currentAttemptIndex: number;
  nextLifterId: string | null;
  competitionMode: CompetitionMode;
  activeGroupName: string | null;
  // TODO: Replace polling with your real-time API hook
  // TODO: Add `apiUrl?: string` and `pollInterval?: number` when you wire your backend
};

export default function LiveScoreboard({
  lifters,
  currentLifterId,
  currentLift,
  currentAttemptIndex,
  nextLifterId,
  competitionMode,
  activeGroupName,
}: LiveScoreboardProps) {
  const { fontSize, increase, decrease, zoom, zoomIn, zoomOut, zoomReset, showControls, setShowControls } = useFontSize();
  const clock = useLiveClock();
  const containerRef = useRef<HTMLDivElement>(null);

  // TODO: Replace this with your real API polling / WebSocket hook
  // Expected endpoint: GET /api/competition/{id}/scoreboard
  // Expected response shape:
  // {
  //   currentLifter: { name: "Aman", weight: 90.0, lift: "squat", attemptIndex: 0 },
  //   nextLifter: { name: "Rahul", weight: 100.0 },
  //   categories: [
  //     {
  //       name: "JUNIOR MEN (IPF)",
  //       sex: "MEN",
  //       federation: "IPF",
  //       weightRange: "53 – 59 KG",
  //       lifters: [...]
  //     }
  //   ],
  //   competitionMode: "FULL_GAME"
  // }
  // For now, we derive data from existing props (same as your current app)
  const data = useMemo(
    () => buildScoreboardData(lifters, currentLifterId, currentLift, currentAttemptIndex, nextLifterId, competitionMode),
    [lifters, currentLifterId, currentLift, currentAttemptIndex, nextLifterId, competitionMode],
  );

  // Keyboard shortcut: H = hide controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") {
        setShowControls((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setShowControls]);

  const isBenchOnly = competitionMode === "BENCH_ONLY";
  const totalLifterCount = useMemo(
    () => data.categories.reduce((sum, category) => sum + category.lifters.length, 0),
    [data.categories],
  );

  // Lifting order: pending attempts for current lift/attempt-index, sorted by
  // declared weight ascending, then lot. Starts at the current lifter and
  // continues through the last lifter of the round; updates automatically as
  // attempts complete.
  const liftingOrder = useMemo(() => {
    const entries = lifters
      .map((l) => {
        const w = resolveAttemptWeight(l, currentLift, currentAttemptIndex);
        const attempts = currentLift === "squat" ? l.squatAttempts : currentLift === "bench" ? l.benchAttempts : l.deadliftAttempts;
        const status = attempts[currentAttemptIndex]?.status;
        return { l, w, status };
      })
      .filter((e) => e.w > 0 && (e.status === "PENDING" || e.status === "UNATTEMPTED"))
      .sort((a, b) => {
        if (a.w !== b.w) return a.w - b.w;
        const la = typeof a.l.lot === "number" ? a.l.lot : Infinity;
        const lb = typeof b.l.lot === "number" ? b.l.lot : Infinity;
        return la - lb;
      });
    const idx = currentLifterId ? entries.findIndex((e) => e.l.id === currentLifterId) : -1;
    return idx >= 0 ? entries.slice(idx) : entries;
  }, [lifters, currentLift, currentAttemptIndex, currentLifterId]);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const measure = () => {
      const height = node.getBoundingClientRect().height || window.innerHeight || 0;
      setContainerHeight(Math.floor(height));
    };

    measure();
    window.addEventListener("resize", measure);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(node);
    }

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, []);

  const layoutMetrics = useMemo(() => {
    const categoryCount = Math.max(data.categories.length, 1);
    const viewportHeight = containerHeight || (typeof window !== "undefined" ? window.innerHeight : 1080);
    const categoryHeaderHeight = categoryCount > 8 ? 14 : categoryCount > 4 ? 16 : 18;
    const tableHeaderRowHeight = categoryCount > 8 ? 13 : categoryCount > 4 ? 15 : 17;
    const sectionGap = categoryCount > 4 ? 0 : 1;
    const rowSlots = Math.max(TARGET_VISIBLE_ROWS, totalLifterCount || TARGET_VISIBLE_ROWS);
    const reservedHeight = tableHeaderRowHeight * 2 + categoryCount * categoryHeaderHeight + Math.max(0, categoryCount - 1) * sectionGap;
    const calculatedRowHeight = Math.floor((viewportHeight - reservedHeight - 2) / rowSlots);
    const rowHeight = Math.max(MIN_DENSE_ROW_HEIGHT, Math.min(MAX_DENSE_ROW_HEIGHT, calculatedRowHeight));
    const fontBase = Math.max(MIN_DENSE_FONT, Math.min(MAX_FONT, fontSize));

    return {
      rowHeight,
      fontBase,
      categoryHeaderHeight,
      tableHeaderRowHeight,
      sectionGap,
      cellPadX: rowHeight <= 20 ? 2 : rowHeight <= 28 ? 3 : 4,
      namePadX: rowHeight <= 20 ? 3 : rowHeight <= 28 ? 5 : 7,
    };
  }, [containerHeight, data.categories.length, fontSize, totalLifterCount]);

  const columnWidths = isBenchOnly
    ? ["4%", "26%", "17%", "8%", "9%", "9%", "9%", "8%", "10%"]
    : ["3.2%", "18%", "14%", "5%", "4.8%", "4.8%", "4.8%", "4.8%", "4.8%", "4.8%", "4.8%", "4.8%", "4.8%", "7%", "9.6%"];
  const columnCount = columnWidths.length;

  // Base CSS variable for rem scaling
  const rootStyle = {
    "--sb-font-base": `${layoutMetrics.fontBase}px`,
    "--sb-row-height": `${layoutMetrics.rowHeight}px`,
    "--sb-head-row-height": `${layoutMetrics.tableHeaderRowHeight}px`,
    "--sb-category-height": `${layoutMetrics.categoryHeaderHeight}px`,
    "--sb-section-gap": `${layoutMetrics.sectionGap}px`,
    "--sb-cell-pad-x": `${layoutMetrics.cellPadX}px`,
    "--sb-name-pad-x": `${layoutMetrics.namePadX}px`,
    fontSize: `${layoutMetrics.fontBase}px`,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textRendering: "optimizeLegibility",
    fontFeatureSettings: '"tnum" 1, "kern" 1',
  } as React.CSSProperties;

  const zoomWrapperStyle: React.CSSProperties = {
    zoom: zoom,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minHeight: "100%",
  };

  return (
    <div
      ref={containerRef}
      className="display-scoreboard flex h-full w-full flex-col overflow-auto font-sans"
      style={rootStyle}
    >
      <style>{`
        .display-scoreboard {
          width: 100vw;
          height: 100%;
          max-width: 100vw;
          min-height: 0;
        }
        .display-scoreboard .display-zoom-wrapper {
          flex: 1 1 auto;
        }
        .display-scoreboard,
        .display-scoreboard * {
          box-sizing: border-box;
        }
        .display-scoreboard .display-scoreboard-table-area {
          min-height: 0;
          width: 100%;
          height: 100%;
        }
        .display-scoreboard .display-category-header {
          height: var(--sb-category-height);
          min-height: var(--sb-category-height);
          max-height: var(--sb-category-height);
          gap: var(--sb-cell-pad-x);
          padding: 0 var(--sb-name-pad-x) !important;
          line-height: var(--sb-category-height);
          overflow: hidden;
          white-space: nowrap;
        }
        .display-scoreboard .display-category-header span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .display-scoreboard .display-category-row > td {
          height: var(--sb-category-height) !important;
          min-height: var(--sb-category-height) !important;
          max-height: var(--sb-category-height) !important;
          padding: 0 !important;
          line-height: var(--sb-category-height) !important;
        }
        .display-scoreboard .display-table {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .display-scoreboard .display-table th,
        .display-scoreboard .display-table td {
          height: var(--sb-row-height);
          min-height: var(--sb-row-height);
          max-height: var(--sb-row-height);
          padding: 0 var(--sb-cell-pad-x) !important;
          line-height: calc(var(--sb-row-height) - 2px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          vertical-align: middle;
        }
        .display-scoreboard .display-table thead th {
          height: var(--sb-head-row-height);
          min-height: var(--sb-head-row-height);
          max-height: var(--sb-head-row-height);
          line-height: calc(var(--sb-head-row-height) - 1px);
          padding: 0 var(--sb-cell-pad-x) !important;
        }
        .display-scoreboard .display-name-cell {
          padding-left: var(--sb-name-pad-x) !important;
          padding-right: var(--sb-name-pad-x) !important;
        }
        .display-scoreboard .display-district-cell {
          letter-spacing: 0 !important;
          text-overflow: clip !important;
          font-size: clamp(7px, calc(var(--sb-font-base) * var(--district-font-scale, 0.8125)), calc(var(--sb-font-base) * 0.8125));
        }
      `}</style>
      {/* ════════════════════════════════════════════════
          TOP STATUS BAR
      ════════════════════════════════════════════════ */}

      {/* ════════════════════════════════════════════════
          LIFTING ORDER BAR (auto-updates as attempts complete)
      ════════════════════════════════════════════════ */}
      {liftingOrder.length > 0 && (
        <div
          className="display-order-bar flex items-center gap-2 border-b border-white/10 bg-[#0b1220] px-2"
          style={{
            height: "calc(var(--sb-font-base) * 1.6)",
            fontSize: "calc(var(--sb-font-base) * 0.82)",
            lineHeight: 1.1,
            overflow: "hidden",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          <span className="font-black uppercase tracking-wider text-[#f59e0b]" style={{ letterSpacing: "0.06em" }}>
            Order
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {liftingOrder.map((e, i) => {
              const isCurrent = i === 0;
              const isNext = i === 1;
              return (
                <span
                  key={e.l.id}
                  className={
                    isCurrent
                      ? "rounded-sm bg-[#eab308] px-1.5 font-black text-black"
                      : isNext
                        ? "rounded-sm bg-white/10 px-1.5 font-bold text-white"
                        : "px-1 text-[#cbd5e1]"
                  }
                  style={{ flex: "0 0 auto" }}
                >
                  {i + 1}. {e.l.name.split(" ")[0]} {e.w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          RESULTS TABLE (scrollable)
      ════════════════════════════════════════════════ */}
      <div className="display-zoom-wrapper" style={zoomWrapperStyle}>
      <div className="display-scoreboard-table-area flex-1 overflow-visible">
        {data.categories.length > 0 ? (
          <table className="display-table w-full" style={{ borderCollapse: "collapse" }}>
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="display-table-head">
                {/* Rank column */}
                <th
                  rowSpan={2}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  #
                </th>
                {/* Name */}
                <th
                  rowSpan={2}
                  className="display-name-cell border border-white/5 px-2 py-0.5 text-left font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  Name
                </th>
                {/* Team/District */}
                <th
                  rowSpan={2}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  Dist
                </th>
                {/* BW */}
                <th
                  rowSpan={2}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  BW
                </th>
                {/* SQUAT group header */}
                {!isBenchOnly && (
                  <th
                    colSpan={3}
                    className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                    style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                  >
                    Squat
                  </th>
                )}
                {/* BENCH group header */}
                <th
                  colSpan={3}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  Bench Press
                </th>
                {/* DEADLIFT group header */}
                {!isBenchOnly && (
                  <th
                    colSpan={3}
                    className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                    style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                  >
                    Deadlift
                  </th>
                )}
                {/* TOTAL */}
                <th
                  rowSpan={2}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  Total
                </th>
                {/* GL */}
                <th
                  rowSpan={2}
                  className="border border-white/5 px-1 py-0.5 text-center font-black uppercase tracking-wider text-[#9ca3af]"
                  style={{ fontSize: "calc(var(--sb-font-base) * 0.75)" }}
                >
                  GL
                </th>
              </tr>
              {/* Sub-column headers */}
              <tr className="display-table-head">
                {!isBenchOnly && (
                  <>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>SQ1</th>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>SQ2</th>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>SQ3</th>
                  </>
                )}
                <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>BP1</th>
                <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>BP2</th>
                <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>BP3</th>
                {!isBenchOnly && (
                  <>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>DL1</th>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>DL2</th>
                    <th className="border border-white/5 px-1 py-0.5 text-center text-[10px] font-bold text-[#6b7280]" style={{ fontSize: "calc(var(--sb-font-base) * 0.6875)" }}>DL3</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category, catIdx) => {
                const colors = getCategoryColor(category.name);
                return (
                  <Fragment key={catIdx}>
                    <tr className="display-category-row">
                      <td colSpan={columnCount} className="border border-white/5">
                        <div
                          className="display-category-header flex items-center border-b"
                          style={{
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            fontSize: "calc(var(--sb-font-base) * 0.8125)",
                          }}
                        >
                          <span className="font-black uppercase tracking-wide text-white">
                            {category.name}
                          </span>
                          <span className="shrink-0 text-white/60">
                            ({category.lifters.length})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {category.lifters.map((lifter, idx) => {
                    const isCurrent = lifter.id === currentLifterId;
                    const districtName = displayDistrictName(lifter.team);
                    const districtFontScale = districtName.length > 28 ? 0.56 : districtName.length > 22 ? 0.64 : districtName.length > 17 ? 0.72 : 0.8125;
                    const rowBg = isCurrent
                      ? "display-table-row-current"
                      : idx % 2 === 0
                        ? "display-table-row-even"
                        : "display-table-row-odd";
                    return (
                      <tr key={lifter.id} className={`${rowBg} border-b border-white/[0.03]`}>
                        {/* # */}
                        <td
                          className={`border border-white/5 px-1 py-0.5 text-center tabular-nums font-bold ${isCurrent ? "text-[#06b6d4]" : "text-[#6b7280]"}`}
                          style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                        >
                          {idx + 1}
                        </td>
                        {/* NAME */}
                        <td
                          className={`display-name-cell border border-white/5 px-2 py-0.5 font-semibold text-white ${isCurrent ? "text-white" : ""}`}
                          style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                        >
                          {isCurrent && <span className="mr-1 text-[#06b6d4]">▶</span>}
                          {lifter.name || "—"}
                        </td>
                        {/* DIST */}
                        <td
                          className="display-district-cell border border-white/5 px-1 py-0.5 text-center text-[#9ca3af]"
                          style={{ "--district-font-scale": districtFontScale } as React.CSSProperties}
                          title={districtName || undefined}
                        >
                          {districtName || "—"}
                        </td>
                        {/* BW */}
                        <td
                          className="border border-white/5 px-1 py-0.5 text-center tabular-nums text-[#9ca3af]"
                          style={{ fontSize: "calc(var(--sb-font-base) * 0.8125)" }}
                        >
                          {typeof lifter.bodyweight === "number" ? lifter.bodyweight.toFixed(1) : "—"}
                        </td>
                        {/* SQUAT attempts */}
                        {!isBenchOnly && (
                          <>
                            {lifter.squatAttempts.map((att, ai) => {
                              const cell = formatAttemptCell(att, false);
                              return (
                                <td
                                  key={`sq${ai}`}
                                  className={`border border-white/5 px-1 py-0.5 text-center tabular-nums ${cell.className}`}
                                  style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                                >
                                  {cell.text}
                                </td>
                              );
                            })}
                          </>
                        )}
                        {/* BENCH attempts */}
                        {lifter.benchAttempts.map((att, ai) => {
                          const cell = formatAttemptCell(att, false);
                          return (
                            <td
                              key={`bp${ai}`}
                              className={`border border-white/5 px-1 py-0.5 text-center tabular-nums ${cell.className}`}
                              style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                        {/* DEADLIFT attempts */}
                        {!isBenchOnly && (
                          <>
                            {lifter.deadliftAttempts.map((att, ai) => {
                              const cell = formatAttemptCell(att, false);
                              return (
                                <td
                                  key={`dl${ai}`}
                                  className={`border border-white/5 px-1 py-0.5 text-center tabular-nums ${cell.className}`}
                                  style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                                >
                                  {cell.text}
                                </td>
                              );
                            })}
                          </>
                        )}
                        {/* TOTAL */}
                        <td
                          className="border border-white/5 px-1 py-0.5 text-center tabular-nums font-bold text-[#06b6d4]"
                          style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                        >
                          {lifter.total > 0 ? lifter.total.toFixed(1) : "—"}
                        </td>
                        {/* GL */}
                        <td
                          className="border border-white/5 px-1 py-0.5 text-center tabular-nums font-bold text-white"
                          style={{ fontSize: "calc(var(--sb-font-base) * 0.875)" }}
                        >
                          {lifter.glPoints > 0 ? lifter.glPoints.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex h-64 items-center justify-center text-[#6b7280]">
            No lifters configured. Add lifters in the admin panel.
          </div>
        )}
      </div>
      </div>



      {/* ════════════════════════════════════════════════
          FONT SIZE CONTROL (floating, bottom-right)
      ════════════════════════════════════════════════ */}
      {showControls && (
        <div className="display-floating-widget fixed bottom-10 right-4 z-50 flex flex-col gap-2 rounded-lg border border-white/10 bg-black/70 px-3 py-2 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white/60">Display Size</span>
            <button
              onClick={() => setShowControls(false)}
              className="rounded px-1 py-0.5 text-[10px] font-bold text-white/40 hover:bg-white/10 hover:text-white"
              title="Hide (H)"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={decrease}
              className="display-floating-button flex h-7 w-7 items-center justify-center rounded bg-white/10 text-sm font-bold text-white hover:bg-white/20"
              aria-label="Decrease font size"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-sm font-bold text-white tabular-nums">
              {fontSize}px
            </span>
            <button
              onClick={increase}
              className="display-floating-button flex h-7 w-7 items-center justify-center rounded bg-white/10 text-sm font-bold text-white hover:bg-white/20"
              aria-label="Increase font size"
            >
              +
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="text-xs font-bold text-white/60">Zoom</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="display-floating-button flex h-7 w-7 items-center justify-center rounded bg-white/10 text-sm font-bold text-white hover:bg-white/20"
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={zoomReset}
              className="min-w-[3rem] rounded bg-white/5 px-1 text-center text-sm font-bold text-white tabular-nums hover:bg-white/15"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="display-floating-button flex h-7 w-7 items-center justify-center rounded bg-white/10 text-sm font-bold text-white hover:bg-white/20"
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>
          <p className="text-[10px] text-white/30">Press H to toggle · Zoom is for this screen only</p>
        </div>
      )}

      {/* Hidden corner button to re-show controls */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="fixed bottom-2 right-2 z-50 h-6 w-6 rounded-full bg-white/5 text-[10px] text-white/20 hover:bg-white/10 hover:text-white/50"
          title="Show controls (H)"
        >
          ⚙
        </button>
      )}
    </div>
  );
}
