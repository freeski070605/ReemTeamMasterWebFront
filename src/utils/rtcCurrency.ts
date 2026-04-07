export const RTC_ASSETS = {
  1000: "/assets/rtc/rtc_1k.png",
  5000: "/assets/rtc/rtc_5k.png",
  10000: "/assets/rtc/rtc_10k.png",
  20000: "/assets/rtc/rtc_20k.png",
} as const;

export type RTCDenomination = keyof typeof RTC_ASSETS;

const RTC_DENOMINATIONS: RTCDenomination[] = [20000, 10000, 5000, 1000];

export const getRTCAsset = (amount: number): string => {
  if (amount >= 20000) return RTC_ASSETS[20000];
  if (amount >= 10000) return RTC_ASSETS[10000];
  if (amount >= 5000) return RTC_ASSETS[5000];
  return RTC_ASSETS[1000];
};

export const breakIntoRTC = (amount: number, maxParticles = 40): RTCDenomination[] => {
  let remaining = Math.max(0, Math.trunc(amount));
  const result: RTCDenomination[] = [];

  for (const denomination of RTC_DENOMINATIONS) {
    while (remaining >= denomination && result.length < maxParticles) {
      result.push(denomination);
      remaining -= denomination;
    }
  }

  if (remaining > 0 && result.length < maxParticles) {
    result.push(1000);
  }

  return result;
};

const COMPACT_RTC_UNITS = [
  { value: 1_000_000_000_000, suffix: "T" },
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
] as const;

const trimTrailingZero = (value: string): string => value.replace(/\.0$/, "");

export const formatRTCCompactAmount = (amount: number | null | undefined): string => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "0";
  }

  const normalizedAmount = Math.max(0, Math.trunc(amount));
  const unit = COMPACT_RTC_UNITS.find((candidate) => normalizedAmount >= candidate.value);

  if (!unit) {
    return normalizedAmount.toLocaleString("en-US");
  }

  const scaledValue = normalizedAmount / unit.value;
  const fractionDigits = scaledValue >= 100 || Number.isInteger(scaledValue) ? 0 : 1;
  return `${trimTrailingZero(scaledValue.toFixed(fractionDigits))}${unit.suffix}`;
};

export const formatRTCAmount = (amount: number): string =>
  `${formatRTCCompactAmount(amount)} RTC`;
