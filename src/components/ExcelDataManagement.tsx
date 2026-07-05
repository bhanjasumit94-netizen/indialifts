import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAppContext } from "../App";
import type { Lifter, Attempt } from "../lib/types";

const COLUMNS = [
  "Lifter Name",
  "Gender",
  "Date of Birth",
  "Competition Category",
  "Body Weight (kg)",
  "Weight Class",
  "Manual Weight Class",
  "Custom Weight Class",
  "Group",
  "Squat Rack Height",
  "Bench Rack Height",
  "Lot Number",
  "State",
  "District",
  "Team",
  "Equipped",
  "Disqualified",
  "SQ1",
  "SQ2",
  "SQ3",
  "BP1",
  "BP2",
  "BP3",
  "DL1",
  "DL2",
  "DL3",
  "Remarks",
] as const;

type RowObj = Record<string, unknown>;

type ImportSummary = {
  fileName: string;
  dateIso: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: number;
  timeMs: number;
  errorRows: RowObj[];
};

const HISTORY_KEY = "excel_import_history_v1";

const SAMPLE_ROWS: RowObj[] = [
  { "Lifter Name": "Aarav Sharma", Gender: "Male", "Date of Birth": "2010-05-14", "Competition Category": "Sub Junior Men", "Body Weight (kg)": 58.4, "Group": "A", "Squat Rack Height": 10, "Bench Rack Height": 4, "Lot Number": 1, State: "Maharashtra", District: "Mumbai", Team: "Mumbai Powerhouse", Equipped: "No", Disqualified: "No", SQ1: 120, BP1: 70, DL1: 140, Remarks: "" },
  { "Lifter Name": "Rohit Verma", Gender: "Male", "Date of Birth": "2005-09-02", "Competition Category": "Junior Men", "Body Weight (kg)": 82.5, "Group": "A", "Squat Rack Height": 12, "Bench Rack Height": 5, "Lot Number": 2, State: "Delhi", District: "New Delhi", Team: "Delhi Iron", Equipped: "No", Disqualified: "No", SQ1: 180, BP1: 120, DL1: 210 },
  { "Lifter Name": "Vikram Singh", Gender: "Male", "Date of Birth": "1996-01-18", "Competition Category": "Senior Men", "Body Weight (kg)": 92.1, "Group": "B", "Squat Rack Height": 14, "Bench Rack Height": 6, "Lot Number": 3, State: "Punjab", District: "Ludhiana", Team: "Punjab Strong", Equipped: "Yes", Disqualified: "No", SQ1: 240, BP1: 160, DL1: 270 },
  { "Lifter Name": "Suresh Kumar", Gender: "Male", "Date of Birth": "1985-07-22", "Competition Category": "Master 1 Men", "Body Weight (kg)": 104, "Group": "B", "Squat Rack Height": 13, "Bench Rack Height": 5, "Lot Number": 4, State: "Karnataka", District: "Bengaluru Urban", Team: "Bengaluru Barbell", Equipped: "No", Disqualified: "No", SQ1: 220, BP1: 145, DL1: 250 },
  { "Lifter Name": "Rajesh Menon", Gender: "Male", "Date of Birth": "1975-03-10", "Competition Category": "Master 2 Men", "Body Weight (kg)": 88, "Group": "C", "Squat Rack Height": 12, "Bench Rack Height": 5, "Lot Number": 5, State: "Kerala", District: "Ernakulam", Team: "Kochi Lifters", Equipped: "No", Disqualified: "No", SQ1: 180, BP1: 130, DL1: 210 },
  { "Lifter Name": "Anil Rao", Gender: "Male", "Date of Birth": "1965-11-30", "Competition Category": "Master 3 Men", "Body Weight (kg)": 82, "Group": "C", "Squat Rack Height": 11, "Bench Rack Height": 4, "Lot Number": 6, State: "Tamil Nadu", District: "Chennai", Team: "Chennai Titans", Equipped: "No", Disqualified: "No", SQ1: 150, BP1: 100, DL1: 180 },
  { "Lifter Name": "Prakash Iyer", Gender: "Male", "Date of Birth": "1955-04-08", "Competition Category": "Master 4 Men", "Body Weight (kg)": 76, "Group": "C", "Squat Rack Height": 10, "Bench Rack Height": 4, "Lot Number": 7, State: "Gujarat", District: "Ahmedabad", Team: "Ahmedabad Elite", Equipped: "No", Disqualified: "No", SQ1: 110, BP1: 80, DL1: 140 },
  { "Lifter Name": "Priya Nair", Gender: "Female", "Date of Birth": "2011-08-19", "Competition Category": "Sub Junior Women", "Body Weight (kg)": 46, "Group": "A", "Squat Rack Height": 9, "Bench Rack Height": 3, "Lot Number": 8, State: "Kerala", District: "Thiruvananthapuram", Team: "Kerala Queens", Equipped: "No", Disqualified: "No", SQ1: 70, BP1: 40, DL1: 90 },
  { "Lifter Name": "Ananya Gupta", Gender: "Female", "Date of Birth": "2004-12-05", "Competition Category": "Junior Women", "Body Weight (kg)": 62, "Group": "A", "Squat Rack Height": 10, "Bench Rack Height": 3, "Lot Number": 9, State: "Rajasthan", District: "Jaipur", Team: "Jaipur Warriors", Equipped: "No", Disqualified: "No", SQ1: 100, BP1: 55, DL1: 120 },
  { "Lifter Name": "Neha Kapoor", Gender: "Female", "Date of Birth": "1995-06-25", "Competition Category": "Senior Women", "Body Weight (kg)": 71, "Group": "B", "Squat Rack Height": 11, "Bench Rack Height": 4, "Lot Number": 10, State: "Haryana", District: "Gurugram", Team: "Gurugram Force", Equipped: "Yes", Disqualified: "No", SQ1: 140, BP1: 80, DL1: 170 },
  { "Lifter Name": "Meera Joshi", Gender: "Female", "Date of Birth": "1984-02-14", "Competition Category": "Master 1 Women", "Body Weight (kg)": 65, "Group": "B", "Squat Rack Height": 10, "Bench Rack Height": 3, "Lot Number": 11, State: "Maharashtra", District: "Pune", Team: "Pune Panthers", Equipped: "No", Disqualified: "No", SQ1: 110, BP1: 60, DL1: 140 },
  { "Lifter Name": "Sunita Rani", Gender: "Female", "Date of Birth": "1974-10-01", "Competition Category": "Master 2 Women", "Body Weight (kg)": 78, "Group": "C", "Squat Rack Height": 11, "Bench Rack Height": 4, "Lot Number": 12, State: "West Bengal", District: "Kolkata", Team: "Bengal Bears", Equipped: "No", Disqualified: "No", SQ1: 90, BP1: 55, DL1: 120 },
  { "Lifter Name": "Kamala Devi", Gender: "Female", "Date of Birth": "1962-05-20", "Competition Category": "Master 3 Women", "Body Weight (kg)": 60, "Group": "C", "Squat Rack Height": 9, "Bench Rack Height": 3, "Lot Number": 13, State: "Uttar Pradesh", District: "Lucknow", Team: "Lucknow Lions", Equipped: "No", Disqualified: "No", SQ1: 70, BP1: 40, DL1: 100 },
  { "Lifter Name": "Lakshmi Amma", Gender: "Female", "Date of Birth": "1954-09-11", "Competition Category": "Master 4 Women", "Body Weight (kg)": 55, "Group": "C", "Squat Rack Height": 8, "Bench Rack Height": 3, "Lot Number": 14, State: "Karnataka", District: "Mysuru", Team: "Mysuru Might", Equipped: "No", Disqualified: "No", SQ1: 55, BP1: 30, DL1: 80 },
];

function truthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return /^(y|yes|true|1)$/i.test(v.trim());
  return false;
}

function toNumOrEmpty(v: unknown): number | "" {
  if (v === "" || v == null) return "";
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : "";
}

function buildAttempts(a: unknown, b: unknown, c: unknown): Attempt[] {
  return [a, b, c].map((w) => ({ weight: toNumOrEmpty(w), status: "UNATTEMPTED" as const }));
}

function lifterToRow(l: Lifter, extras: Partial<Record<string, unknown>> = {}): RowObj {
  const grp = Array.isArray(l.group) ? l.group.join(", ") : l.group;
  return {
    "Lifter Name": l.name,
    Gender: l.sex,
    "Date of Birth": l.dob,
    "Competition Category": l.category,
    "Body Weight (kg)": l.bodyweight,
    "Weight Class": l.weightClass,
    "Manual Weight Class": l.manualWeightClass,
    "Custom Weight Class": (l as unknown as { customWeightClass?: string }).customWeightClass ?? "",
    Group: grp,
    "Squat Rack Height": l.rackHeightSquat,
    "Bench Rack Height": l.rackHeightBench,
    "Lot Number": l.lot,
    State: (l as unknown as { state?: string }).state ?? "",
    District: (l as unknown as { district?: string }).district ?? "",
    Team: l.team,
    Equipped: l.isEquipped ? "Yes" : "No",
    Disqualified: l.disqualified ? "Yes" : "No",
    SQ1: l.squatAttempts[0]?.weight ?? "",
    SQ2: l.squatAttempts[1]?.weight ?? "",
    SQ3: l.squatAttempts[2]?.weight ?? "",
    BP1: l.benchAttempts[0]?.weight ?? "",
    BP2: l.benchAttempts[1]?.weight ?? "",
    BP3: l.benchAttempts[2]?.weight ?? "",
    DL1: l.deadliftAttempts[0]?.weight ?? "",
    DL2: l.deadliftAttempts[1]?.weight ?? "",
    DL3: l.deadliftAttempts[2]?.weight ?? "",
    Remarks: (l as unknown as { remarks?: string }).remarks ?? "",
    ...extras,
  };
}

function downloadWorkbook(rows: RowObj[], sheetName: string, fileName: string, headers: readonly string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...headers] });
  // auto-size cols
  const colWidths = headers.map((h) => {
    const maxLen = rows.reduce((m, r) => {
      const v = r[h];
      return Math.max(m, v == null ? 0 : String(v).length);
    }, h.length);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  (ws as unknown as { ["!cols"]?: unknown })["!cols"] = colWidths;
  (ws as unknown as { ["!freeze"]?: unknown })["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

function readHistory(): ImportSummary[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ImportSummary[]) : [];
  } catch {
    return [];
  }
}
function writeHistory(list: ImportSummary[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }
}

export default function ExcelDataManagement() {
  const { lifters, setLifters } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    rows: RowObj[];
    dups: { row: RowObj; existing: Lifter }[];
    resolve: (choice: "skip" | "replace" | "import" | "cancel") => void;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ImportSummary[]>(() => readHistory());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<{
    category: string;
    group: string;
    gender: string;
    weightClass: string;
    state: string;
    district: string;
    team: string;
    equipped: string;
    disqualified: string;
  }>({ category: "", group: "", gender: "", weightClass: "", state: "", district: "", team: "", equipped: "", disqualified: "" });

  const uniqueVals = useMemo(() => {
    const s = (fn: (l: Lifter) => string) => Array.from(new Set(lifters.map(fn).filter(Boolean))).sort();
    return {
      categories: s((l) => l.category),
      groups: s((l) => (Array.isArray(l.group) ? l.group.join(", ") : l.group || "")),
      weightClasses: s((l) => l.weightClass),
      teams: s((l) => l.team),
    };
  }, [lifters]);

  const errorRowsRef = useRef<RowObj[]>([]);

  async function chooseDuplicateAction(dups: { row: RowObj; existing: Lifter }[], rows: RowObj[]) {
    return new Promise<"skip" | "replace" | "import" | "cancel">((resolve) => {
      setDuplicatePrompt({ rows, dups, resolve });
    });
  }

  async function handleImport(file: File) {
    setBusy(true);
    setSummary(null);
    errorRowsRef.current = [];
    setStatus("Uploading...");
    setProgress(2);
    const start = Date.now();
    try {
      setStatus("Reading Excel...");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RowObj>(ws, { defval: "" });
      setProgress(15);

      setStatus("Checking Data...");
      // duplicate detection against existing lifters
      const dups: { row: RowObj; existing: Lifter }[] = [];
      for (const r of rows) {
        const name = String(r["Lifter Name"] ?? "").trim();
        const dob = String(r["Date of Birth"] ?? "").trim();
        const cat = String(r["Competition Category"] ?? "").trim();
        if (!name) continue;
        const existing = lifters.find(
          (l) =>
            l.name.trim().toLowerCase() === name.toLowerCase() &&
            ((dob && l.dob === dob) || (cat && l.category === cat)),
        );
        if (existing) dups.push({ row: r, existing });
      }

      let dupChoice: "skip" | "replace" | "import" | "cancel" = "import";
      if (dups.length > 0) {
        dupChoice = await chooseDuplicateAction(dups, rows);
        setDuplicatePrompt(null);
      }
      if (dupChoice === "cancel") {
        setBusy(false);
        setStatus("Cancelled");
        setProgress(0);
        return;
      }

      setStatus("Importing...");
      const validGender = (g: unknown): "Male" | "Female" | null => {
        const s = String(g ?? "").trim().toLowerCase();
        if (["m", "male"].includes(s)) return "Male";
        if (["f", "female"].includes(s)) return "Female";
        return null;
      };

      const existingByKey = new Map<string, Lifter>();
      lifters.forEach((l) => {
        existingByKey.set(`${l.name.toLowerCase()}|${l.dob}|${l.category}`, l);
      });

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      let warnings = 0;

      const newLifters: Lifter[] = [...lifters];

      const chunk = 200;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        for (let j = 0; j < slice.length; j++) {
          const idx = i + j;
          const r = slice[j];
          const name = String(r["Lifter Name"] ?? "").trim();
          const gender = validGender(r["Gender"]);
          const category = String(r["Competition Category"] ?? "").trim();
          const rowErrors: string[] = [];
          if (!name) rowErrors.push("Missing Lifter Name");
          if (!gender) rowErrors.push("Invalid Gender");
          if (!category) rowErrors.push("Missing Competition Category");
          if (rowErrors.length) {
            failed++;
            errorRowsRef.current.push({ ...r, "Error Reason": rowErrors.join("; ") });
            continue;
          }

          const bw = toNumOrEmpty(r["Body Weight (kg)"]);
          const dob = String(r["Date of Birth"] ?? "").trim();
          const key = `${name.toLowerCase()}|${dob}|${category}`;
          const existing = existingByKey.get(key);

          const isDup = dups.some((d) => d.row === r);
          if (isDup && dupChoice === "skip") {
            skipped++;
            continue;
          }

          const partial: Partial<Lifter> = {
            id: existing?.id ?? `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            sex: gender!,
            dob,
            bodyweight: bw,
            manualWeightClass: String(r["Manual Weight Class"] ?? "").trim(),
            weightClass: String(r["Weight Class"] ?? "").trim() || undefined,
            category,
            group: String(r["Group"] ?? "").trim(),
            team: (() => {
              const t = String(r["Team"] ?? "").trim();
              if (t) return t;
              const st = String(r["State"] ?? "").trim();
              const dt = String(r["District"] ?? "").trim();
              if (st && dt) return `India - ${st} - ${dt}`;
              if (st) return `India - ${st}`;
              return "Independent";
            })(),
            rackHeightSquat: toNumOrEmpty(r["Squat Rack Height"]),
            rackHeightBench: toNumOrEmpty(r["Bench Rack Height"]),
            lot: toNumOrEmpty(r["Lot Number"]),
            isEquipped: truthy(r["Equipped"]),
            disqualified: truthy(r["Disqualified"]),
            squatAttempts: buildAttempts(r["SQ1"], r["SQ2"], r["SQ3"]),
            benchAttempts: buildAttempts(r["BP1"], r["BP2"], r["BP3"]),
            deadliftAttempts: buildAttempts(r["DL1"], r["DL2"], r["DL3"]),
          };
          // Force auto weight class if no manual and bw present
          if (!partial.manualWeightClass) partial.weightClass = undefined;

          if (existing && isDup && dupChoice === "replace") {
            const i2 = newLifters.findIndex((l) => l.id === existing.id);
            if (i2 >= 0) newLifters[i2] = { ...existing, ...partial } as Lifter;
            updated++;
          } else {
            newLifters.push(partial as Lifter);
            imported++;
          }

          const missing: string[] = [];
          if (!String(r["Team"] ?? "").trim()) missing.push("Team");
          if (!String(r["Group"] ?? "").trim()) missing.push("Group");
          if (missing.length) warnings++;
        }
        setProgress(15 + Math.round(((i + slice.length) / rows.length) * 75));
        setStatus(`Importing row ${Math.min(i + slice.length, rows.length)} / ${rows.length}...`);
        await new Promise((r) => setTimeout(r, 0));
      }

      setStatus("Saving...");
      setLifters(newLifters);
      setProgress(100);
      setStatus("Completed");

      const s: ImportSummary = {
        fileName: file.name,
        dateIso: new Date().toISOString(),
        totalRows: rows.length,
        imported,
        updated,
        skipped,
        failed,
        warnings,
        timeMs: Date.now() - start,
        errorRows: errorRowsRef.current,
      };
      setSummary(s);
      const nextHist = [...readHistory(), s];
      writeHistory(nextHist);
      setHistory(nextHist);
    } catch (e) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const downloadErrorReport = (rows: RowObj[]) => {
    if (!rows.length) return;
    downloadWorkbook(rows, "Errors", `import-errors-${Date.now()}.xlsx`, [...COLUMNS, "Error Reason"]);
  };

  const doExport = () => {
    const filtered = lifters.filter((l) => {
      const g = Array.isArray(l.group) ? l.group.join(", ") : l.group || "";
      if (exportFilter.category && l.category !== exportFilter.category) return false;
      if (exportFilter.group && g !== exportFilter.group) return false;
      if (exportFilter.gender && l.sex !== exportFilter.gender) return false;
      if (exportFilter.weightClass && l.weightClass !== exportFilter.weightClass) return false;
      if (exportFilter.team && l.team !== exportFilter.team) return false;
      if (exportFilter.equipped && String(l.isEquipped) !== exportFilter.equipped) return false;
      if (exportFilter.disqualified && String(l.disqualified) !== exportFilter.disqualified) return false;
      return true;
    });
    const rows = filtered.map((l) => lifterToRow(l));
    downloadWorkbook(rows, "Lifters", `lifters-export-${Date.now()}.xlsx`, COLUMNS);
    setExportOpen(false);
  };

  const btn = "rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50";
  const btnPrimary = `${btn} bg-cyan-500 text-black`;
  const btnGhost = `${btn} bg-white/10 text-white border border-white/15`;

  return (
    <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-white/5 p-5 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
      <h3 className="mb-4 text-lg font-bold text-cyan-300">Excel Data Management</h3>

      <div className="flex flex-wrap gap-2">
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          📥 Import Lifters Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        <button className={btnPrimary} onClick={() => setExportOpen(true)}>
          📤 Export Lifters Excel
        </button>
        <button
          className={btnGhost}
          onClick={() => downloadWorkbook([], "Template", "lifters-blank-template.xlsx", COLUMNS)}
        >
          📄 Download Blank Template
        </button>
        <button
          className={btnGhost}
          onClick={() => downloadWorkbook(SAMPLE_ROWS, "Sample", "lifters-sample-template.xlsx", COLUMNS)}
        >
          📄 Download Sample Template
        </button>
        <button className={btnGhost} onClick={() => setShowHistory((v) => !v)}>
          📊 Import History
        </button>
        {summary && summary.errorRows.length > 0 && (
          <button
            className={`${btn} bg-red-500/80 text-white`}
            onClick={() => downloadErrorReport(summary.errorRows)}
          >
            📋 Download Error Report
          </button>
        )}
      </div>

      {busy && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="mb-2 flex justify-between text-sm text-cyan-200">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {summary && !busy && (
        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/90 sm:grid-cols-3">
          <div>Total Rows: <b>{summary.totalRows}</b></div>
          <div>Imported: <b className="text-emerald-300">{summary.imported}</b></div>
          <div>Updated: <b className="text-cyan-300">{summary.updated}</b></div>
          <div>Skipped: <b className="text-yellow-300">{summary.skipped}</b></div>
          <div>Failed: <b className="text-red-300">{summary.failed}</b></div>
          <div>Warnings: <b className="text-orange-300">{summary.warnings}</b></div>
          <div className="sm:col-span-3">Time: {(summary.timeMs / 1000).toFixed(2)}s</div>
        </div>
      )}

      {showHistory && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-cyan-200">Import History</div>
            <button
              className="text-xs text-white/60 hover:text-white"
              onClick={() => {
                writeHistory([]);
                setHistory([]);
              }}
            >
              Clear
            </button>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-white/60">No imports yet.</div>
          ) : (
            <table className="min-w-full text-xs text-white/90">
              <thead className="text-cyan-200">
                <tr>
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">File</th>
                  <th className="px-2 py-1">Total</th>
                  <th className="px-2 py-1">Imported</th>
                  <th className="px-2 py-1">Updated</th>
                  <th className="px-2 py-1">Skipped</th>
                  <th className="px-2 py-1">Failed</th>
                  <th className="px-2 py-1">Warnings</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-2 py-1">{new Date(h.dateIso).toLocaleString()}</td>
                    <td className="px-2 py-1">{h.fileName}</td>
                    <td className="px-2 py-1 text-center">{h.totalRows}</td>
                    <td className="px-2 py-1 text-center">{h.imported}</td>
                    <td className="px-2 py-1 text-center">{h.updated}</td>
                    <td className="px-2 py-1 text-center">{h.skipped}</td>
                    <td className="px-2 py-1 text-center">{h.failed}</td>
                    <td className="px-2 py-1 text-center">{h.warnings}</td>
                    <td className="px-2 py-1">
                      {h.errorRows.length > 0 && (
                        <button
                          className="rounded bg-red-500/70 px-2 py-0.5 text-xs"
                          onClick={() => downloadErrorReport(h.errorRows)}
                        >
                          Errors
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {duplicatePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-slate-900 p-5">
            <h4 className="mb-2 text-lg font-bold text-cyan-300">Duplicate Lifters Detected</h4>
            <p className="mb-4 text-sm text-white/80">
              {duplicatePrompt.dups.length} row(s) match existing lifters. What would you like to do?
            </p>
            <div className="flex flex-col gap-2">
              <button className={btnPrimary} onClick={() => duplicatePrompt.resolve("skip")}>Skip Duplicates</button>
              <button className={btnPrimary} onClick={() => duplicatePrompt.resolve("replace")}>Replace Existing</button>
              <button className={btnGhost} onClick={() => duplicatePrompt.resolve("import")}>Import Anyway</button>
              <button className={`${btn} bg-red-500/70 text-white`} onClick={() => duplicatePrompt.resolve("cancel")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-slate-900 p-5">
            <h4 className="mb-3 text-lg font-bold text-cyan-300">Export Lifters</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { key: "category", label: "Category", opts: uniqueVals.categories },
                { key: "group", label: "Group", opts: uniqueVals.groups },
                { key: "gender", label: "Gender", opts: ["Male", "Female"] },
                { key: "weightClass", label: "Weight Class", opts: uniqueVals.weightClasses },
                { key: "team", label: "Team", opts: uniqueVals.teams },
                { key: "equipped", label: "Equipped", opts: ["true", "false"] },
                { key: "disqualified", label: "Disqualified", opts: ["true", "false"] },
              ].map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-white/80">
                  {f.label}
                  <select
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-white"
                    value={(exportFilter as Record<string, string>)[f.key]}
                    onChange={(e) =>
                      setExportFilter((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {f.opts.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setExportOpen(false)}>Cancel</button>
              <button className={btnPrimary} onClick={doExport}>Export</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
