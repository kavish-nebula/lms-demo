type NotesExport = { courseTitle: string; notes: string; date: string };

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Isolated print document: notes are text, including pasted markup, never executable HTML. */
export function notesPrintHtml({ courseTitle, notes, date }: NotesExport): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(courseTitle)} - My notes</title>
<style>
  @page { size: A4; margin: 18mm; }
  :root { color-scheme: light; }
  body { margin: 0; color: black; background: white; font: 11pt/1.6 Arial, sans-serif; }
  header { border-bottom: 1pt solid gray; margin-bottom: 18pt; padding-bottom: 14pt; break-inside: avoid; }
  .brand, .date { margin: 0; font-size: 9pt; color: dimgray; }
  h1 { margin: 8pt 0 2pt; font-size: 24pt; line-height: 1.2; }
  .course { margin: 0 0 8pt; font-size: 13pt; overflow-wrap: anywhere; }
  .notes { white-space: pre-wrap; overflow-wrap: anywhere; orphans: 3; widows: 3; }
</style></head><body>
<header><p class="brand">Nebula KnowLab</p><h1>My notes</h1><p class="course">${escapeHtml(courseTitle)}</p><p class="date">Exported ${escapeHtml(date)}</p></header>
<main class="notes">${escapeHtml(notes)}</main>
</body></html>`;
}

/** Browser printing keeps Unicode and pagination native, without a server or external fonts. */
export function exportNotesPdf(input: NotesExport): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Export my notes to PDF";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
    let cleanupTimer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(cleanupTimer); frame.remove(); };
    frame.onload = async () => {
      try {
        const printWindow = frame.contentWindow;
        if (!printWindow) throw new Error("The print preview could not open.");
        await frame.contentDocument?.fonts.ready;
        printWindow.addEventListener("afterprint", cleanup, { once: true });
        // Also release the temporary frame if the browser omits afterprint.
        cleanupTimer = setTimeout(cleanup, 60_000);
        printWindow.focus();
        printWindow.print();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    frame.srcdoc = notesPrintHtml(input);
    document.body.appendChild(frame);
  });
}
