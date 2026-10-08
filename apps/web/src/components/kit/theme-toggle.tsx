"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Kit-only control: flips the theme attribute on <html> for this page view so
 * every component can be checked in both themes. Learners use Settings instead.
 */
export function ThemeToggle() {
  const [aurora, setAurora] = React.useState(true);

  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme !== "aurora";
    if (next) root.dataset.theme = "aurora";
    else delete root.dataset.theme;
    setAurora(next);
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label="Switch theme for this page">
      {aurora ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
      Switch theme
    </Button>
  );
}
