import type { ActivitySubmission } from "./adaptive-onboarding";

export type WorkspaceDraft = { text: string; selected: string[]; events: NonNullable<ActivitySubmission["events"]> };
export type WorkspaceEdit = { type: "add" | "remove" | "move"; itemId: string; position?: number } | { type: "edit"; text: string };
export const emptyWorkspace = (): WorkspaceDraft => ({ text: "", selected: [], events: [] });

/** Editing mechanics only. Knowledge, consequences and adaptation are judged by the model. */
export function editWorkspace(draft: WorkspaceDraft, edit: WorkspaceEdit): WorkspaceDraft {
  let selected = [...draft.selected];
  if (edit.type === "add") { if (selected.includes(edit.itemId) || selected.length >= 5) return draft; selected.push(edit.itemId); }
  if (edit.type === "remove") selected = selected.filter((id) => id !== edit.itemId);
  if (edit.type === "move") {
    const before = selected.indexOf(edit.itemId), next = edit.position;
    if (before < 0 || next === undefined || next < 0 || next >= selected.length || before === next) return draft;
    selected.splice(before, 1); selected.splice(next, 0, edit.itemId);
  }
  // Keep a bounded trace, leaving room for the final run event. Never store keystrokes.
  const event = edit.type === "edit" ? { type: "edit" as const } : edit;
  return { text: edit.type === "edit" ? edit.text.slice(0, 2400) : draft.text, selected, events: [...draft.events, event].slice(-79) };
}

export function restoreWorkspace(value: unknown, itemIds: string[]): WorkspaceDraft {
  if (!value || typeof value !== "object") return emptyWorkspace();
  const saved = value as Partial<WorkspaceDraft>;
  const valid = new Set(itemIds);
  const selected = Array.isArray(saved.selected) ? [...new Set(saved.selected.filter((id) => typeof id === "string" && valid.has(id)))].slice(0, 5) : [];
  // History is evidence too: do not trust a stale/malformed browser draft.
  const events = Array.isArray(saved.events) ? saved.events.filter((e) => e && ["add", "remove", "move", "edit"].includes(e.type) && (!e.itemId || valid.has(e.itemId)) && (e.position === undefined || Number.isInteger(e.position) && e.position >= 0 && e.position < 5)).map((e) => ({ type: e.type, ...(e.itemId ? { itemId: e.itemId } : {}), ...(e.position !== undefined ? { position: e.position } : {}) })).slice(-79) : [];
  return { text: typeof saved.text === "string" ? saved.text.slice(0, 2400) : "", selected, events };
}
