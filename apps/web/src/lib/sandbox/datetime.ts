/**
 * The slice of Luxon's DateTime that n8n expressions use most, so date
 * expressions written here work unchanged in real n8n:
 * DateTime.fromISO / fromFormat / fromJSDate / now, isValid, toISODate,
 * toFormat, toISO. Dates only carry calendar fields; there are no zones.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export class DateTime {
  readonly isValid: boolean;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;

  private constructor(p: Parts | null) {
    const ok =
      !!p &&
      p.month >= 1 &&
      p.month <= 12 &&
      p.day >= 1 &&
      p.day <= daysIn(p.year, p.month) &&
      p.hour < 24 &&
      p.minute < 60 &&
      p.second < 60;
    this.isValid = ok;
    this.year = ok ? p!.year : NaN;
    this.month = ok ? p!.month : NaN;
    this.day = ok ? p!.day : NaN;
    this.hour = ok ? p!.hour : NaN;
    this.minute = ok ? p!.minute : NaN;
    this.second = ok ? p!.second : NaN;
  }

  static invalid() {
    return new DateTime(null);
  }

  static fromObject(o: Partial<Parts>) {
    return new DateTime({ year: o.year ?? 1970, month: o.month ?? 1, day: o.day ?? 1, hour: o.hour ?? 0, minute: o.minute ?? 0, second: o.second ?? 0 });
  }

  static fromJSDate(d: Date) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return DateTime.invalid();
    return DateTime.fromObject({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    });
  }

  static now() {
    return DateTime.fromJSDate(new Date());
  }

  /** 2026-03-14, 2026-03-14T08:15:00Z, 2026-03-14 08:15 (the calendar fields as written) */
  static fromISO(text: unknown) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(text ?? "").trim());
    if (!m) return DateTime.invalid();
    return DateTime.fromObject({ year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: +(m[4] ?? 0), minute: +(m[5] ?? 0), second: +(m[6] ?? 0) });
  }

  /** Luxon tokens: yyyy yy MMMM MMM MM M dd d HH H mm ss, 'quoted literals' */
  static fromFormat(text: unknown, format: string) {
    const src = String(text ?? "");
    const groups: string[] = [];
    let re = "";
    for (const tok of tokenize(format)) {
      if (tok.literal != null) {
        re += tok.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        continue;
      }
      groups.push(tok.token);
      re += PARSE[tok.token] ?? "";
    }
    const m = new RegExp(`^${re}$`, "i").exec(src);
    if (!m) return DateTime.invalid();
    const p: Parts = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
    groups.forEach((g, i) => {
      const v = m[i + 1]!;
      if (g === "yyyy") p.year = +v;
      else if (g === "yy") p.year = 2000 + +v;
      else if (g === "MMMM" || g === "MMM") p.month = MONTHS.findIndex((n) => n.toLowerCase().startsWith(v.toLowerCase().slice(0, 3))) + 1;
      else if (g === "MM" || g === "M") p.month = +v;
      else if (g === "dd" || g === "d") p.day = +v;
      else if (g === "HH" || g === "H") p.hour = +v;
      else if (g === "mm") p.minute = +v;
      else if (g === "ss") p.second = +v;
    });
    return new DateTime(p);
  }

  toISODate(): string | null {
    return this.isValid ? `${this.year}-${pad(this.month)}-${pad(this.day)}` : null;
  }

  toISO(): string | null {
    return this.isValid ? `${this.toISODate()}T${pad(this.hour)}:${pad(this.minute)}:${pad(this.second)}.000Z` : null;
  }

  toFormat(format: string): string {
    if (!this.isValid) return "Invalid DateTime";
    const dow = new Date(Date.UTC(this.year, this.month - 1, this.day)).getUTCDay();
    return tokenize(format)
      .map((t) => {
        if (t.literal != null) return t.literal;
        switch (t.token) {
          case "yyyy":
            return String(this.year);
          case "yy":
            return pad(this.year % 100);
          case "MMMM":
            return MONTHS[this.month - 1];
          case "MMM":
            return MONTHS[this.month - 1]!.slice(0, 3);
          case "MM":
            return pad(this.month);
          case "M":
            return String(this.month);
          case "dd":
            return pad(this.day);
          case "d":
            return String(this.day);
          case "EEEE":
            return DAYS[dow];
          case "EEE":
            return DAYS[dow]!.slice(0, 3);
          case "HH":
            return pad(this.hour);
          case "H":
            return String(this.hour);
          case "mm":
            return pad(this.minute);
          case "ss":
            return pad(this.second);
          default:
            return t.token;
        }
      })
      .join("");
  }

  toString() {
    return this.isValid ? (this.toISO() as string) : "Invalid DateTime";
  }

  toJSON() {
    return this.toISO();
  }
}

const PARSE: Record<string, string> = {
  yyyy: "(\\d{4})",
  yy: "(\\d{2})",
  MMMM: "([A-Za-z]{3,9})",
  MMM: "([A-Za-z]{3})",
  MM: "(\\d{2})",
  M: "(\\d{1,2})",
  dd: "(\\d{2})",
  d: "(\\d{1,2})",
  HH: "(\\d{2})",
  H: "(\\d{1,2})",
  mm: "(\\d{2})",
  ss: "(\\d{2})",
};

const TOKENS = ["yyyy", "yy", "MMMM", "MMM", "MM", "M", "dd", "d", "EEEE", "EEE", "HH", "H", "mm", "ss"];

function tokenize(format: string): { token: string; literal?: string }[] {
  const out: { token: string; literal?: string }[] = [];
  let i = 0;
  while (i < format.length) {
    if (format[i] === "'") {
      const end = format.indexOf("'", i + 1);
      const lit = format.slice(i + 1, end < 0 ? undefined : end);
      out.push({ token: "", literal: lit });
      i = end < 0 ? format.length : end + 1;
      continue;
    }
    const tok = TOKENS.find((t) => format.startsWith(t, i));
    if (tok) {
      out.push({ token: tok });
      i += tok.length;
    } else {
      out.push({ token: "", literal: format[i] });
      i += 1;
    }
  }
  return out;
}
