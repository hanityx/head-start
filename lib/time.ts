const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");

/** UTC epoch ms → KST 문자열 (YYYY-MM-DD HH:mm:ss[.SSS]) */
export function nowKstString(withMs = false): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const base =
    `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())} ` +
    `${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(kst.getUTCSeconds())}`;
  return withMs ? `${base}.${pad3(kst.getUTCMilliseconds())}` : base;
}

/** epoch ms → KST 밀리초 포함 문자열 */
export function toKstMsString(epochMs: number): string | null {
  if (!epochMs) return null;
  const kst = new Date(epochMs + 9 * 60 * 60 * 1000);
  return (
    `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())} ` +
    `${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(kst.getUTCSeconds())}.${pad3(kst.getUTCMilliseconds())}`
  );
}
