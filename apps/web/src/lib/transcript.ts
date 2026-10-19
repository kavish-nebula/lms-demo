/**
 * Did a recording say the line it was asked to say? Text-to-speech models
 * sometimes answer a line instead of reading it ("Answer five short
 * questions…" came back as a made-up question), so every recording is
 * transcribed and compared before it is kept. Loose on wording and
 * punctuation, strict on content: most of the line's words must be heard,
 * and not much else.
 */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

export function matchesTranscript(expected: string, heard: string): boolean {
  const want = words(expected);
  const got = words(heard);
  if (!want.length) return true;
  if (!got.length) return false;
  const have = new Set(got);
  const found = want.filter((w) => have.has(w)).length / want.length;
  const length = got.length / want.length;
  return found >= 0.8 && length >= 0.6 && length <= 1.6;
}
