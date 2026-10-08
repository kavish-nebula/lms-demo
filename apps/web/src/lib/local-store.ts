"use client";

import * as React from "react";

/**
 * localStorage as an external store. Reads go through useSyncExternalStore so
 * the server render and first client render agree (server snapshot is null),
 * and every component reading a key updates when any writer changes it.
 * Storage can be blocked (private mode, policies), so every access is guarded.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the value lives only in memory listeners for this view.
  }
  listeners.forEach((l) => l());
}

export function clearLocal(prefix: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  listeners.forEach((l) => l());
}

/** Raw string for a key; null on the server and when unset. */
export function useLocalString(key: string): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => safeGet(key),
    () => null,
  );
}

function prefixSnapshot(prefix: string): string {
  try {
    const out: Record<string, string> = {};
    for (const k of Object.keys(localStorage).sort()) if (k.startsWith(prefix)) out[k] = localStorage.getItem(k) ?? "";
    return JSON.stringify(out);
  } catch {
    return "{}";
  }
}

/**
 * Every key starting with `prefix`, as { key: parsed JSON }. The snapshot is
 * a string so useSyncExternalStore can compare it cheaply.
 */
export function useLocalPrefix<T>(prefix: string): Record<string, T> {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => prefixSnapshot(prefix),
    () => "{}",
  );
  return React.useMemo(() => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) {
      try {
        out[k] = JSON.parse(v) as T;
      } catch {}
    }
    return out;
  }, [raw]);
}

/** Parsed JSON for a key, falling back when unset or unparsable. */
export function useLocalJson<T>(key: string, fallback: T): T {
  const raw = useLocalString(key);
  return React.useMemo(() => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // fallback is intentionally not a dependency: callers pass literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
}

const noopSubscribe = () => () => {};

/**
 * False during server render and hydration, true afterwards. Pages whose
 * layout depends on localStorage (enrolled or not) show a skeleton until
 * this flips, so they never flash the wrong view.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
