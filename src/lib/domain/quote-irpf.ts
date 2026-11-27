import { parseDecimalToHundredths } from "./money";
import { MAX_IRPF_RATE_HUNDREDTHS } from "./quote-totals";

export const IRPF_RATE_CHOICES = ["0", "7", "15"] as const;

export type IrpfRateOptions = {
  options: string[];
  selected: string;
};

function toHundredths(text: string): number | null {
  const result = parseDecimalToHundredths(text, MAX_IRPF_RATE_HUNDREDTHS);
  return result.ok ? result.value : null;
}

export function buildIrpfRateOptions(current: string): IrpfRateOptions {
  const options: string[] = [...IRPF_RATE_CHOICES];
  const trimmed = current.trim();
  if (trimmed === "") return { options, selected: "0" };

  const currentHundredths = toHundredths(trimmed);
  const match = IRPF_RATE_CHOICES.find((choice) => toHundredths(choice) === currentHundredths);
  if (currentHundredths !== null && match !== undefined) return { options, selected: match };

  return { options: [...options, trimmed], selected: trimmed };
}
