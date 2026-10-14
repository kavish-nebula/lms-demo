/**
 * Runs the learner's Python in the browser, safely. The code goes into a
 * sandboxed iframe (srcDoc, scripts only: no access to this app, its cookies
 * or its API), and Python (Pyodide) runs in a worker inside it, so a slow or
 * endless loop never freezes the page: past the time limit the iframe is
 * removed, which stops the worker, and the next run starts a fresh one.
 */

/** Pyodide 0.29.5 (Python 3.13), loaded from jsdelivr once and then cached by the browser. */
export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/";

const BOOT_MS = 90_000;
export const RUN_MS = 20_000;

// The worker: start Python once, then for each run write the files to /project and call run.run().
const WORKER = `
let py = null;
const ready = (async () => {
  importScripts(${JSON.stringify(`${PYODIDE_URL}pyodide.js`)});
  py = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} });
  py.setStdout({ batched: (text) => postMessage({ type: "stdout", text }) });
  py.setStderr({ batched: (text) => postMessage({ type: "stdout", text }) });
  py.runPython("import sys\\nsys.dont_write_bytecode = True");
})().then(
  () => postMessage({ type: "ready" }),
  (e) => postMessage({ type: "boot-error", message: String((e && e.message) || e) }),
);
onmessage = async ({ data }) => {
  await ready.catch(() => {});
  if (!py) return;
  try {
    for (const [path, content] of Object.entries(data.files)) {
      const full = "/project/" + path;
      py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
      py.FS.writeFile(full, content);
    }
    py.globals.set("TICKETS", JSON.stringify(data.tickets));
    py.globals.set("SEEDS", JSON.stringify(data.seeds));
    const out = py.runPython([
      "import importlib, os, sys",
      "os.chdir('/project')",
      "sys.path.insert(0, '/project') if '/project' not in sys.path else None",
      "sys.modules.pop('run', None)",
      "importlib.invalidate_caches()",
      "import run",
      "run.run(TICKETS, SEEDS)",
    ].join("\\n"));
    postMessage({ type: "result", id: data.id, json: out });
  } catch (e) {
    postMessage({ type: "result", id: data.id, error: String((e && e.message) || e) });
  }
};
`;

const FRAME = `<!doctype html><meta charset="utf-8"><script>
let worker = null;
try {
  worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(WORKER)}], { type: "text/javascript" })));
  worker.onmessage = (e) => parent.postMessage(e.data, "*");
  worker.onerror = (e) => parent.postMessage({ type: "boot-error", message: e.message || "Python couldn't start." }, "*");
} catch (e) {
  parent.postMessage({ type: "boot-error", message: "This browser can't start the Python sandbox: " + e.message }, "*");
}
addEventListener("message", (e) => { if (e.source === parent && worker) worker.postMessage(e.data); });
</script>`;

/** What run.py reports. `fatal`: prompt_engine.py couldn't even be imported. */
export type RunOutput = { fatal?: string; where?: string; records: RunRecordFull[] };

export type RunRecordFull = {
  ticket: string;
  seed: number;
  step: "ask_model" | "parse_reply" | "decide" | "done";
  messages?: { role: string; content: string }[] | string;
  raw?: string;
  parsed?: unknown;
  decision?: unknown;
  error?: string;
  where?: string | null;
};

export class SandboxError extends Error {
  constructor(
    message: string,
    readonly kind: "boot" | "timeout" | "crash",
  ) {
    super(message);
  }
}

type Pending = { resolve: (o: RunOutput) => void; reject: (e: Error) => void; timer: number };

export class PythonSandbox {
  private frame: HTMLIFrameElement | null = null;
  private booted: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private bootWaiter: { resolve: () => void; reject: (e: Error) => void } | null = null;

  constructor(
    private readonly on: { stdout: (text: string) => void; status: (state: "booting" | "ready" | "down") => void },
  ) {}

  private listen = (e: MessageEvent) => {
    if (!this.frame || e.source !== this.frame.contentWindow) return;
    const m = e.data as { type: string; id?: number; text?: string; message?: string; json?: string; error?: string };
    if (m.type === "stdout" && m.text != null) this.on.stdout(m.text);
    else if (m.type === "ready") this.bootWaiter?.resolve();
    else if (m.type === "boot-error") this.bootWaiter?.reject(new SandboxError(m.message ?? "Python couldn't start.", "boot"));
    else if (m.type === "result" && m.id != null) {
      const p = this.pending.get(m.id);
      if (!p) return;
      window.clearTimeout(p.timer);
      this.pending.delete(m.id);
      if (m.error) p.reject(new SandboxError(m.error, "crash"));
      else {
        try {
          p.resolve(JSON.parse(m.json ?? "{}") as RunOutput);
        } catch {
          p.reject(new SandboxError("The run's results couldn't be read.", "crash"));
        }
      }
    }
  };

  /** Starts Python (a download the first time); later calls reuse it. */
  boot(): Promise<void> {
    if (this.booted) return this.booted;
    this.on.status("booting");
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = FRAME;
    window.addEventListener("message", this.listen);
    this.frame = frame;
    this.booted = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new SandboxError("Python took too long to load. Check your connection and try again.", "boot")), BOOT_MS);
      this.bootWaiter = {
        resolve: () => {
          window.clearTimeout(timer);
          resolve();
        },
        reject: (e) => {
          window.clearTimeout(timer);
          reject(e);
        },
      };
    }).then(
      () => this.on.status("ready"),
      (e) => {
        this.dispose();
        throw e;
      },
    );
    document.body.appendChild(frame);
    return this.booted;
  }

  /** Runs run.run(tickets, seeds) over the given files. */
  async run(files: Record<string, string>, tickets: unknown[], seeds: number[], timeoutMs = RUN_MS): Promise<RunOutput> {
    await this.boot();
    const id = ++this.seq;
    return new Promise<RunOutput>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.dispose(); // stops the worker; the next run starts a fresh sandbox
        reject(new SandboxError(`Your code ran for more than ${Math.round(timeoutMs / 1000)} seconds and was stopped. Is there a loop that never ends?`, "timeout"));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.frame?.contentWindow?.postMessage({ id, files, tickets, seeds }, "*");
    });
  }

  dispose() {
    window.removeEventListener("message", this.listen);
    for (const p of this.pending.values()) {
      window.clearTimeout(p.timer);
      p.reject(new SandboxError("The sandbox was closed.", "crash"));
    }
    this.pending.clear();
    this.frame?.remove();
    this.frame = null;
    this.booted = null;
    this.bootWaiter = null;
    this.on.status("down");
  }
}
