/**
 * Learner display preferences stored under `lms-prefs`. The same logic runs
 * as an inline script before paint (hard loads) and from Providers after
 * hydration (React's dev remount resets <html> attributes).
 */
export const PREFS_KEY = "lms-prefs";

export function prefsScript(allowLight: boolean) {
  return `(function(){try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');var r=document.documentElement;r.classList.toggle('text-lg',p.textScale==='large');r.classList.toggle('reduce-motion',!!p.reduceMotion);${
    allowLight ? "if(p.theme==='light')r.removeAttribute('data-theme');else r.setAttribute('data-theme','aurora');" : ""
  }}catch(e){}})();`;
}

export function applyPrefs(allowLight: boolean) {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as {
      textScale?: string;
      reduceMotion?: boolean;
      theme?: string;
    };
    const r = document.documentElement;
    r.classList.toggle("text-lg", p.textScale === "large");
    r.classList.toggle("reduce-motion", !!p.reduceMotion);
    if (allowLight) {
      if (p.theme === "light") r.removeAttribute("data-theme");
      else r.setAttribute("data-theme", "aurora");
    }
  } catch {
    // storage blocked: keep server defaults
  }
}
