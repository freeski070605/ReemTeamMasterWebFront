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

export const formatRTCAmount = (amount: number): string =>
  `${Math.max(0, Math.trunc(amount)).toLocaleString("en-US")} RTC`;
