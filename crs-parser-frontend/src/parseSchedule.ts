// parseSchedule(rawText, student, semester, options) -> array of row objects
//
// Row shape:
// { day, student, course, semester, room, start, end, mode, startMin, endMin, review }
//   start/end   -> "8:30 AM" strings
//   startMin/endMin -> minutes since midnight (your GRAPHDATA-S / GRAPHDATA-E)
//   review      -> true when the mode couldn't be fully determined from the text

interface ScheduleRow {
  day: string;
  student: string;
  course: string;
  semester: number;
  room: string;
  start: string;
  end: string;
  mode: string;
  startMin: number;
  endMin: number;
  review: boolean;
}

interface CourseBlock {
  course: string;
  text: string;
}

const DAY_NAMES: Record<string, string> = {
  M: "Monday", T: "Tuesday", W: "Wednesday", Th: "Thursday",
  F: "Friday", S: "Saturday", Sa: "Saturday", Su: "Sunday",
};
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LONG_DAYS: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

// a new block starts at a line like "41386<tab>Physics 71 ..." or "Math 21 TWHFY-2"
const BLOCK_START = /^\s*(?:\d{4,6}\s+)?([A-Za-z]+(?: [A-Za-z]+)? \d+[A-Za-z]?)\s+\S/;

// "TTh 4:15-5:15PM lec MB 303"  /  "T 8-10AM PE TBA"
const MEETING = /(?:^|[\s;])((?:Th|Sa|Su|[MTWFS])+)\s+(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*-\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)(?:\s+(?:lec|lab|disc|rec|sem)\b)?\s*([^;\n]*)/gi;

function toMinutes(timeStr: string, meridiem: string): number {
  const [h, m = "0"] = timeStr.split(":");
  return (Number(h) % 12) * 60 + Number(m) + (meridiem.toUpperCase() === "PM" ? 720 : 0);
}

function fmt(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return `${h24 % 12 || 12}:${m} ${h24 >= 12 ? "PM" : "AM"}`;
}

function splitDays(token: string): string[] {
  return (token.match(/Th|Sa|Su|[MTWFS]/g) || []).map((d) => DAY_NAMES[d]);
}

// "(Tue/Thu: Face-to-face, Wed/Fri: Asynchronous online)" -> { Tuesday: "Synchronous", ... }
function parseDayModes(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const paren = block.match(/\(([^)]*(?:async|online)[^)]*)\)/i);
  if (!paren) return out;
  const re = /((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)\s*:\s*([^,)]+)/gi;
  let m;
  while ((m = re.exec(paren[1]))) {
    const mode = /async/i.test(m[2]) ? "Asynchronous" : "Synchronous";
    m[1].split("/").forEach((d) => (out[LONG_DAYS[d[0].toUpperCase() + d.slice(1).toLowerCase()]] = mode));
  }
  return out;
}

export function parseSchedule(rawText: string, student: string, semester: number, options: Record<string, any> = {}) {
  const aliases: Record<string, string> = { Physics: "Phy", ...(options.aliases || {}) };
  // PE classes are held at CHK (College of Human Kinetics); the raw text says "PE TBA"
  const roomAliases: Record<string, string> = { ...(options.roomAliases || {}) };
  const lookupRoom = (r: string): string => {
    const key = Object.keys(roomAliases).find((k: string) => k.toLowerCase() === r.toLowerCase());
    return key ? roomAliases[key] : r;
  };

  // 1. split into course blocks
  const blocks: CourseBlock[] = [];
  for (const line of rawText.split(/\r?\n/)) {
    const m = line.match(BLOCK_START);
    if (m) blocks.push({ course: m[1], text: line });
    else if (blocks.length) blocks[blocks.length - 1].text += "\n" + line;
  }

  // 2. pull meetings out of each block
  const rows: ScheduleRow[] = [];
  for (const { course, text } of blocks) {
    const [first, ...rest] = course.split(" ");
    const courseName = [aliases[first] || first, ...rest].join(" ");
    const dayModes = parseDayModes(text);
    const hasAsyncNote = /async/i.test(text);

    for (const m of text.matchAll(MEETING)) {
      const [, dayTok, s, sMer, e, eMer, roomRaw] = m;
      const endMin = toMinutes(e, eMer);
      let startMin = toMinutes(s, sMer || eMer);
      if (!sMer && startMin >= endMin) startMin -= 720; // "11-1PM" -> 11AM-1PM

      const mapped = lookupRoom(roomRaw.trim());
      const room = /^(TBA)?$/i.test(mapped) ? "" : mapped;

      for (const day of splitDays(dayTok)) {
        let mode = dayModes[day];
        let review = false;
        if (!mode) {
          mode = "Synchronous";
          review = hasAsyncNote; // mentions async but no per-day breakdown
        }
        rows.push({
          day, student, course: courseName, semester,
          room: mode === "Asynchronous" ? "" : room,
          start: fmt(startMin), end: fmt(endMin), mode,
          startMin, endMin, review,
        });
      }
    }
  }

  // 3. sort by day, then start time
  return rows.sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startMin - b.startMin
  );
}

// Tab-separated text you can paste straight into Sheets (no header)
export function toTSV(rows: ScheduleRow[]): string {
  return rows
    .map((r) => [r.day, r.student, r.course, r.semester, r.room, r.start, r.end, r.mode].join("\t"))
    .join("\n");
}