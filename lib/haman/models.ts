/**
 * The Claude models Haman can run on, and how hard he thinks. Partners pick
 * in Settings → Haman (or from the model name at the top of the chat); it
 * applies to everyone. Shared by the server and the screens, so no server
 * imports here.
 *
 * Prices are Anthropic's per million tokens (input / output). A typical
 * question is a few lookups: well under a cent on Haiku, a few cents on Opus.
 */

export type HamanModel = {
  id: string;
  label: string;
  /** One line for the picker. */
  description: string;
  price: string;
  /** Anthropic re-runs a request its safety checks decline on a suitable model (fallbacks: "default"). */
  fallback: boolean;
};

export const HAMAN_MODELS: HamanModel[] = [
  { id: "claude-haiku-5-5", label: "Haiku 5.5", description: "Fastest and cheapest. Fine for quick lookups and simple changes.", price: "$0.10 / $0.50", fallback: false },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", description: "Quick and capable. A good everyday choice.", price: "$2 / $10", fallback: true },
  { id: "claude-opus-5-5", label: "Opus 5.5", description: "Most capable for day-to-day work: multi-step questions and changes.", price: "$4 / $20", fallback: true },
  { id: "claude-fable-5-1", label: "Fable 5.1", description: "Anthropic's most capable model. Slower and the most expensive.", price: "$10 / $50", fallback: true },
];

export const DEFAULT_MODEL = "claude-opus-5-5";

export type HamanEffort = "low" | "medium" | "high";

export const HAMAN_EFFORTS: { id: HamanEffort; label: string; description: string }[] = [
  { id: "low", label: "Quick", description: "Answers fastest and uses the fewest tokens." },
  { id: "medium", label: "Balanced", description: "Thinks a little before answering." },
  { id: "high", label: "Thorough", description: "Thinks longest; best for tricky questions and big changes." },
];

export const DEFAULT_EFFORT: HamanEffort = "medium";

export type HamanSettings = { model: string; effort: HamanEffort };

export const modelLabel = (id: string) => HAMAN_MODELS.find((m) => m.id === id)?.label ?? id;

/** A saved or configured choice, made safe: anything unknown falls back to the default. */
export function normalizeSettings(saved: Partial<HamanSettings> | null | undefined, envModel?: string): HamanSettings {
  const known = (id: string | undefined) => (id && HAMAN_MODELS.some((m) => m.id === id) ? id : undefined);
  // HAMAN_MODEL may name a model this list doesn't (a newer one, or a dated snapshot): honour it unless the app has a choice saved.
  const model = known(saved?.model) ?? (envModel?.trim() || DEFAULT_MODEL);
  const effort = HAMAN_EFFORTS.some((e) => e.id === saved?.effort) ? (saved!.effort as HamanEffort) : DEFAULT_EFFORT;
  return { model, effort };
}
