import { AnswerModelInfo } from './models/answerInfo';

/**
 * A readable name for a model key: local file paths ("C:\Models\x\y.gguf") and
 * namespaced ids ("hf.co/org/model:tag", "nvidia/model:free") keep only the
 * last part, without a ".gguf" extension.
 */
export const shortModelName = (key: string): string => {
  const last = key.split(/[\\/]/).filter(Boolean).pop() ?? key;
  return last.replace(/\.gguf$/i, '');
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const duration = (from: string, to: string): string => {
  const secs = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

/** e.g. "nemotron-3-ultra-550b-a55b:free via OpenRouter · 14:02:11 → 14:02:52 (41s)" */
export const formatAnswerNote = (info: AnswerModelInfo): string => {
  const parts: string[] = [];
  if (info.model) {
    let who = `${shortModelName(info.model.model)} via ${info.model.provider}`;
    if (info.fallbackFrom)
      who += ` (fallback; ${shortModelName(info.fallbackFrom.model)} failed)`;
    parts.push(who);
  }
  parts.push(
    info.completedAt
      ? `${time(info.startedAt)} → ${time(info.completedAt)} (${duration(info.startedAt, info.completedAt)})`
      : `asked ${time(info.startedAt)}`,
  );
  return parts.join(' · ');
};
