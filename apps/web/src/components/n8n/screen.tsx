import * as React from "react";
import { cn } from "cn";
import { ChevronDown, CircleCheck, FlaskConical, Hash, Plus, Search, TriangleAlert, Zap } from "lucide-react";
import { NodeGlyph } from "@/components/n8n/node-glyph";
import type { N8nScreen, ScreenData, ScreenEdge, ScreenField, ScreenNode } from "@/data/types";
import "./screen.css";

type Marks = Record<string, number> | undefined;

/** An element that can carry a numbered badge, matching an instruction. */
function Mk({ id, marks, className, children, style }: { id: string; marks: Marks; className?: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  const n = marks?.[id];
  return (
    <div className={cn(className, n != null && "nx-mark")} style={style}>
      {n != null ? <span className="nx-badge">{n}</span> : null}
      {children}
    </div>
  );
}

/**
 * A recreated n8n screen (n8n 2.x, dark theme) used as the "screenshot" for
 * a guided-practice step. It is an illustration: the whole screen is one
 * image to assistive tech, described by its caption, and the same
 * instructions are in the text beside it.
 */
export function N8nScreenView({ screen, className }: { screen: N8nScreen; className?: string }) {
  return (
    <div role="img" aria-label={screen.caption} className={cn("nx", className)}>
      <div className="nx-frame" aria-hidden>
        <Body screen={screen} />
      </div>
    </div>
  );
}

function Body({ screen }: { screen: N8nScreen }) {
  const m = screen.marks;
  switch (screen.view) {
    case "canvas":
      return (
        <>
          <Chrome name={screen.name} published={screen.published} marks={m} />
          <Canvas nodes={screen.nodes} edges={screen.edges} marks={m} />
          {screen.toast ? (
            <div className="nx-toast">
              <CircleCheck />
              {screen.toast}
            </div>
          ) : null}
        </>
      );
    case "panel":
      return (
        <>
          <Chrome name={screen.name} marks={m} />
          <Canvas nodes={screen.nodes} edges={screen.edges} marks={m} />
          <div className="nx-side-panel">
            <h4>{screen.title}</h4>
            <Mk id="search" marks={m} className="nx-search">
              <Search />
              <span>{screen.search}</span>
            </Mk>
            {screen.items.map((it, i) => (
              <React.Fragment key={it.id}>
                {it.group && it.group !== screen.items[i - 1]?.group ? <div className="nx-group">{it.group}</div> : null}
                <Mk id={it.id} marks={m} className="nx-item">
                  <NodeGlyph icon={it.icon} />
                  <span>
                    <b>{it.name}</b>
                    <small>{it.desc}</small>
                  </span>
                </Mk>
              </React.Fragment>
            ))}
          </div>
        </>
      );
    case "ndv":
      return (
        <>
          <div className="nx-canvas nx-dim" style={{ inset: 0 }} />
          <div className="nx-ndv">
            <Mk id="input" marks={m} className="nx-pane io">
              <h5>
                Input {screen.input ? <small>{items(screen.input.items)}</small> : null}
              </h5>
              {screen.input ? <DataTable data={screen.input} /> : <div className="nx-empty-pane">No input data yet</div>}
            </Mk>
            <div className="nx-pane nx-center">
              <div className="nx-center-head">
                <NodeGlyph icon={screen.icon} />
                <b>{screen.node}</b>
                <Mk id="action" marks={m} className="nx-btn primary">
                  <FlaskConical />
                  {screen.action}
                </Mk>
              </div>
              <div className="nx-ptabs">
                <span className={cn(screen.tab !== "settings" && "on")}>Parameters</span>
                <Mk id="tab-settings" marks={m} className="">
                  <span className={cn(screen.tab === "settings" && "on")}>Settings</span>
                </Mk>
              </div>
              {screen.fields.map((f) => (
                <Field key={f.id} field={f} marks={m} />
              ))}
            </div>
            <Mk id="output" marks={m} className="nx-pane io">
              <h5>
                Output {screen.output ? <small>{items(screen.output.items)}</small> : null}
              </h5>
              {screen.notice ? <div className="nx-notice">{screen.notice}</div> : null}
              {screen.output ? <DataTable data={screen.output} /> : <div className="nx-empty-pane">Execute this node to view data</div>}
            </Mk>
          </div>
        </>
      );
    case "credential":
      return (
        <>
          <div className="nx-canvas nx-dim" style={{ inset: 0 }} />
          <div className="nx-modal">
            <div className="nx-modal-head">
              <NodeGlyph icon={screen.icon} />
              {screen.title}
            </div>
            {screen.fields.map((f) => (
              <Mk key={f.id} id={f.id} marks={m} className="nx-field">
                <label>{f.label}</label>
                <div className="nx-input">{f.value}</div>
              </Mk>
            ))}
            <Mk id="button" marks={m} className="nx-big">
              {screen.button}
            </Mk>
          </div>
        </>
      );
    case "sheet":
      return (
        <div className="nx-sheet">
          <div className="nx-sheet-top">
            <NodeGlyph icon="sheets" />
            <b>{screen.title}</b>
          </div>
          <div className="nx-sheet-bar" />
          <div className="nx-grid">
            <table>
              <thead>
                <tr>
                  <th />
                  {screen.columns.map((_, i) => (
                    <th key={i}>{String.fromCharCode(65 + i)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="head">
                  <th>1</th>
                  {screen.columns.map((c) => (
                    <td key={c}>{c}</td>
                  ))}
                </tr>
                {[...screen.rows, ...Array.from({ length: Math.max(0, 16 - screen.rows.length) }, () => screen.columns.map(() => ""))].map((r, i) => (
                  <tr key={i}>
                    <th>{i + 2}</th>
                    {r.map((v, j) => (
                      <td key={j} className={cn(v !== v.trim() && "nx-ws")}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="nx-sheet-tabs">
            {screen.tabs.map((tab) => (
              <Mk key={tab} id={`tab:${tab}`} marks={m}>
                <span className={cn(tab === screen.tab && "on")}>{tab}</span>
              </Mk>
            ))}
          </div>
        </div>
      );
    case "slack":
      return (
        <div className="nx-slack">
          <div className="nx-slack-head">
            <Hash className="inline size-[1em] align-[-0.1em]" />
            {screen.channel.replace(/^#/, "")}
          </div>
          {screen.messages.map((msg, i) => (
            <Mk key={i} id={`msg:${i}`} marks={m} className="nx-msg">
              <span className="nx-avatar">n8n</span>
              <span>
                <b>{msg.who}</b>
                <span className="nx-app">APP</span>
                <small>{msg.time}</small>
                <span className="block">{msg.text}</span>
              </span>
            </Mk>
          ))}
        </div>
      );
  }
}

const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

function Chrome({ name, published, marks }: { name: string; published?: boolean; marks: Marks }) {
  return (
    <>
      <div className="nx-rail">
        <span className="nx-logo">n8n</span>
        <i />
        <i />
        <i />
      </div>
      <div className="nx-top">
        <Mk id="name" marks={marks} className="nx-crumb">
          <span>Personal ›</span>
          <b>{name}</b>
        </Mk>
        <div className="nx-tabs">
          <span className="on">Editor</span>
          <span>Executions</span>
          <span>Evaluations</span>
        </div>
        <div className="nx-actions">
          <Mk id="save" marks={marks} className="nx-btn">
            Save
          </Mk>
          {published ? (
            <span className="nx-pill">Published</span>
          ) : (
            <Mk id="publish" marks={marks} className="nx-btn primary">
              Publish
            </Mk>
          )}
        </div>
      </div>
    </>
  );
}

/* node half-width as a share of the canvas width, for where edges attach */
const HALF = 3.4;

function Canvas({ nodes, edges, marks }: { nodes: ScreenNode[]; edges: ScreenEdge[]; marks: Marks }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const open = nodes.filter((n) => !edges.some((e) => e.from === n.id));
  return (
    <div className="nx-canvas">
      {nodes.length === 0 ? (
        <div className="nx-empty">
          <Mk id="add" marks={marks} className="nx-add">
            <Plus />
          </Mk>
          <span>Add first step</span>
        </div>
      ) : null}
      <svg className="nx-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map((e) => {
          const a = byId[e.from];
          const b = byId[e.to];
          if (!a || !b) return null;
          const x1 = a.x + HALF;
          const x2 = b.x - HALF;
          const mid = (x1 + x2) / 2;
          return <path key={`${e.from}-${e.to}`} className={cn(e.label && !e.branch && "live")} d={`M${x1},${a.y} C${mid},${a.y} ${mid},${b.y} ${x2},${b.y}`} />;
        })}
      </svg>
      {edges.map((e) => {
        const a = byId[e.from];
        const b = byId[e.to];
        if (!a || !b || (!e.label && !e.branch)) return null;
        return (
          <React.Fragment key={`l-${e.from}-${e.to}`}>
            {e.branch ? (
              <span className="nx-edge-label branch" style={{ left: `${a.x + HALF + 2.5}%`, top: `${a.y + (b.y - a.y) * 0.25}%` }}>
                {e.branch}
              </span>
            ) : null}
            {e.label ? (
              <span className="nx-edge-label" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}>
                {e.label}
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
      {nodes.map((n) => (
        <div key={n.id} className={cn("nx-node", n.trigger && "trigger", n.status)} style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <Mk id={n.id} marks={marks} className="nx-tile">
            <NodeGlyph icon={n.icon} />
            {n.trigger ? <Zap className="nx-bolt" /> : null}
            {n.status === "ok" ? <CircleCheck className="nx-status" /> : n.status === "error" ? <TriangleAlert className="nx-status" /> : null}
          </Mk>
          <span className="nx-name">{n.name}</span>
        </div>
      ))}
      {open.map((n) => (
        <Mk key={`p-${n.id}`} id={`plus:${n.id}`} marks={marks} className="nx-plus" style={{ left: `${n.x + HALF + 3}%`, top: `${n.y}%` }}>
          <Plus />
        </Mk>
      ))}
      <div className="nx-zoom">
        <i />
        <i />
        <i />
      </div>
      <Mk id="execute" marks={marks} className="nx-btn primary nx-execute">
        <FlaskConical />
        Execute workflow
      </Mk>
    </div>
  );
}

function Field({ field: f, marks }: { field: ScreenField; marks: Marks }) {
  switch (f.kind) {
    case "select":
    case "text":
      return (
        <Mk id={f.id} marks={marks} className="nx-field">
          <label>{f.label}</label>
          <div className="nx-input">
            <span className="truncate">{f.value}</span>
            {f.kind === "select" ? <ChevronDown /> : null}
          </div>
        </Mk>
      );
    case "expr":
      return (
        <Mk id={f.id} marks={marks} className="nx-field">
          <label>{f.label}</label>
          <div className="nx-input expr">{f.value}</div>
          {f.result != null ? <div className="nx-result">{f.result}</div> : null}
        </Mk>
      );
    case "toggle":
      return (
        <Mk id={f.id} marks={marks} className="nx-toggle">
          <label>{f.label}</label>
          <span className={cn("nx-switch", f.on && "on")} />
        </Mk>
      );
    case "assign":
      return (
        <Mk id={f.id} marks={marks} className="nx-field">
          <label>{f.label}</label>
          {f.rows.map((r) => (
            <div key={r.name} className="nx-card">
              <div className="nx-row">
                <div className="nx-input">{r.name}</div>
                <div className="nx-input">
                  {r.type}
                  <ChevronDown />
                </div>
              </div>
              <div className="nx-input expr">{r.value}</div>
              {r.result != null ? <div className="nx-result">{r.result}</div> : null}
            </div>
          ))}
        </Mk>
      );
    case "condition":
      return (
        <Mk id={f.id} marks={marks} className="nx-field">
          <label>{f.label}</label>
          {f.rows.map((r, i) => (
            <div key={i} className="nx-row3">
              <div className="nx-input expr">{r.left}</div>
              <div className="nx-input">
                {r.op}
                <ChevronDown />
              </div>
              <div className="nx-input">{r.right ?? ""}</div>
            </div>
          ))}
        </Mk>
      );
    case "button":
      return (
        <Mk id={f.id} marks={marks} className="nx-btn" style={{ alignSelf: "flex-start" }}>
          {f.label}
        </Mk>
      );
  }
}

function DataTable({ data }: { data: ScreenData }) {
  return (
    <table className="nx-table">
      <thead>
        <tr>
          {data.columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => (
              <td key={j}>{v === "" ? "—" : v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
