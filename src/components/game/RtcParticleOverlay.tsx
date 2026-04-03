import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IGameState } from "../../types/game";
import {
  breakIntoRTC,
  formatRTCAmount,
  getRTCAsset,
  RTCDenomination,
} from "../../utils/rtcCurrency";

type Point = {
  x: number;
  y: number;
};

type RTCParticleVisual = {
  id: string;
  asset: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  blur: number;
  glow: number;
  strongGlow: boolean;
};

type RTCParticleModel = {
  id: string;
  denomination: RTCDenomination;
  asset: string;
  width: number;
  height: number;
  start: Point;
  burstEnd?: Point;
  control: Point;
  end: Point;
  delayMs: number;
  burstDurationMs: number;
  collapseDelayMs: number;
  flightDurationMs: number;
  orbitDurationMs: number;
  absorbDurationMs: number;
  rotationStart: number;
  rotationMid: number;
  rotationEnd: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitTurns: number;
  strongGlow: boolean;
};

type WalletPulse = {
  id: string;
  x: number;
  y: number;
  strongGlow: boolean;
};

type FloatingText = {
  id: string;
  x: number;
  y: number;
  text: string;
  strongGlow: boolean;
};

interface RtcParticleOverlayProps {
  gameState: IGameState;
  winnerPlayerId?: string;
  winnerRoundNet: number | null;
  tableRef: React.RefObject<HTMLDivElement | null>;
  seatAnchorRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  displayFont: string;
  isPhoneLandscapeLayout: boolean;
}

const PARTICLE_SIZE_MULTIPLIER: Record<RTCDenomination, number> = {
  1000: 1,
  5000: 1.05,
  10000: 1.1,
  20000: 1.16,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

const easeInCubic = (progress: number) => progress * progress * progress;

const easeInOutCubic = (progress: number) =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const quadraticBezier = (start: Point, control: Point, end: Point, progress: number): Point => {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const withJitter = (point: Point, radius: number): Point => ({
  x: point.x + randomBetween(-radius, radius),
  y: point.y + randomBetween(-radius * 0.8, radius * 0.8),
});

const createRtcId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const getOrbitStartPoint = (particle: RTCParticleModel): Point => {
  const finalAngle = particle.orbitAngle + particle.orbitTurns * Math.PI * 2;
  const finalRadius = particle.orbitRadius * 0.76;
  return {
    x: particle.end.x + Math.cos(finalAngle) * finalRadius,
    y: particle.end.y + Math.sin(finalAngle) * finalRadius * 0.72,
  };
};

const RtcParticleOverlay: React.FC<RtcParticleOverlayProps> = ({
  gameState,
  winnerPlayerId,
  winnerRoundNet,
  tableRef,
  seatAnchorRefs,
  displayFont,
  isPhoneLandscapeLayout,
}) => {
  const [particles, setParticles] = useState<RTCParticleVisual[]>([]);
  const [walletPulses, setWalletPulses] = useState<WalletPulse[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [showReemText, setShowReemText] = useState(false);
  const [screenFlashKey, setScreenFlashKey] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const lastAnimationKeyRef = useRef<string | null>(null);
  const landingPitchStepRef = useRef(0);
  const totalParticleCountRef = useRef(0);
  const landingTriggeredIdsRef = useRef<Set<string>>(new Set());
  const floatingTextShownRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const payoutSignature = Object.entries(gameState.payouts ?? {})
    .sort(([leftUserId], [rightUserId]) => leftUserId.localeCompare(rightUserId))
    .map(([userId, amount]) => `${userId}:${amount}`)
    .join("|");
  const playerSignature = gameState.players.map((player) => player.userId).join("|");
  const playerIds = useMemo(
    () => (playerSignature ? playerSignature.split("|").filter(Boolean) : []),
    [playerSignature]
  );
  const transferSignature = useMemo(() => {
    const shouldConvertWinnerGrossToNet =
      !gameState.mode || gameState.mode === "FREE_RTC_TABLE" || gameState.mode === "RTC_TOURNAMENT";

    return playerIds
      .map((playerId) => {
        const payout = gameState.payouts?.[playerId];
        let roundNet = payout ?? null;

        if (
          payout !== undefined &&
          playerId === gameState.roundWinnerId &&
          shouldConvertWinnerGrossToNet
        ) {
          const ante = gameState.lockedAntes?.[playerId] ?? gameState.baseStake;
          roundNet = payout - ante;
        }

        const lossAmount = roundNet !== null && roundNet < 0 ? Math.abs(roundNet) : 0;
        return `${playerId}:${lossAmount}`;
      })
      .join("|");
  }, [
    gameState.baseStake,
    gameState.lockedAntes,
    gameState.mode,
    gameState.payouts,
    gameState.roundWinnerId,
    playerIds,
  ]);
  const roundTransferBlueprint = useMemo(
    () =>
      transferSignature
        ? transferSignature.split("|").map((entry) => {
            const [playerId, lossAmountText] = entry.split(":");
            return {
              playerId,
              lossAmount: Number(lossAmountText) || 0,
            };
          })
        : [],
    [transferSignature]
  );

  const clearScheduledWork = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  const resetVisuals = useCallback(() => {
    clearScheduledWork();
    setParticles([]);
    setWalletPulses([]);
    setFloatingTexts([]);
    setShowReemText(false);
    totalParticleCountRef.current = 0;
    landingTriggeredIdsRef.current.clear();
    floatingTextShownRef.current = false;
    landingPitchStepRef.current = 0;
  }, [clearScheduledWork]);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const playLandingSound = useCallback(
    (strongGlow: boolean) => {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      void audioContext.resume().catch(() => undefined);

      const now = audioContext.currentTime;
      const pitchStep = landingPitchStepRef.current % 6;
      landingPitchStepRef.current += 1;

      const attackGain = audioContext.createGain();
      attackGain.gain.setValueAtTime(0.0001, now);
      attackGain.gain.exponentialRampToValueAtTime(strongGlow ? 0.05 : 0.035, now + 0.014);
      attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      attackGain.connect(audioContext.destination);

      const attackOscillator = audioContext.createOscillator();
      attackOscillator.type = "triangle";
      attackOscillator.frequency.setValueAtTime(260 + pitchStep * 24, now);
      attackOscillator.frequency.exponentialRampToValueAtTime(420 + pitchStep * 22, now + 0.12);
      attackOscillator.connect(attackGain);
      attackOscillator.start(now);
      attackOscillator.stop(now + 0.16);

      const shimmerGain = audioContext.createGain();
      shimmerGain.gain.setValueAtTime(0.0001, now);
      shimmerGain.gain.exponentialRampToValueAtTime(strongGlow ? 0.028 : 0.02, now + 0.01);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      shimmerGain.connect(audioContext.destination);

      const shimmerOscillator = audioContext.createOscillator();
      shimmerOscillator.type = "sine";
      shimmerOscillator.frequency.setValueAtTime(1100 + pitchStep * 60, now);
      shimmerOscillator.frequency.exponentialRampToValueAtTime(1680 + pitchStep * 40, now + 0.18);
      shimmerOscillator.connect(shimmerGain);
      shimmerOscillator.start(now);
      shimmerOscillator.stop(now + 0.22);
    },
    [getAudioContext]
  );

  const playReemSound = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    void audioContext.resume().catch(() => undefined);

    const now = audioContext.currentTime;

    const impactGain = audioContext.createGain();
    impactGain.gain.setValueAtTime(0.0001, now);
    impactGain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    impactGain.connect(audioContext.destination);

    const impactOscillator = audioContext.createOscillator();
    impactOscillator.type = "sine";
    impactOscillator.frequency.setValueAtTime(120, now);
    impactOscillator.frequency.exponentialRampToValueAtTime(64, now + 0.24);
    impactOscillator.connect(impactGain);
    impactOscillator.start(now);
    impactOscillator.stop(now + 0.36);

    const riseGain = audioContext.createGain();
    riseGain.gain.setValueAtTime(0.0001, now + 0.04);
    riseGain.gain.exponentialRampToValueAtTime(0.04, now + 0.14);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    riseGain.connect(audioContext.destination);

    const riseOscillator = audioContext.createOscillator();
    riseOscillator.type = "triangle";
    riseOscillator.frequency.setValueAtTime(280, now + 0.04);
    riseOscillator.frequency.exponentialRampToValueAtTime(760, now + 0.44);
    riseOscillator.connect(riseGain);
    riseOscillator.start(now + 0.04);
    riseOscillator.stop(now + 0.48);
  }, [getAudioContext]);

  const getRelativeAnchorPoint = useCallback(
    (playerId: string): Point | null => {
      const tableNode = tableRef.current;
      const anchorNode = seatAnchorRefs.current[playerId];

      if (!tableNode || !anchorNode) {
        return null;
      }

      const tableBounds = tableNode.getBoundingClientRect();
      const anchorBounds = anchorNode.getBoundingClientRect();

      if (tableBounds.width === 0 || tableBounds.height === 0) {
        return null;
      }

      return {
        x: anchorBounds.left - tableBounds.left + anchorBounds.width / 2,
        y: anchorBounds.top - tableBounds.top + anchorBounds.height / 2,
      };
    },
    [seatAnchorRefs, tableRef]
  );

  const triggerSeatImpact = useCallback(
    (playerId: string, strongGlow: boolean) => {
      const anchorNode = seatAnchorRefs.current[playerId];
      if (!anchorNode) return;

      anchorNode.classList.remove(
        "rt-rtc-wallet-bounce",
        "rt-rtc-wallet-glow",
        "rt-rtc-wallet-glow-strong"
      );
      void anchorNode.offsetWidth;
      anchorNode.classList.add(
        "rt-rtc-wallet-bounce",
        strongGlow ? "rt-rtc-wallet-glow-strong" : "rt-rtc-wallet-glow"
      );

      const timeoutId = window.setTimeout(() => {
        anchorNode.classList.remove(
          "rt-rtc-wallet-bounce",
          "rt-rtc-wallet-glow",
          "rt-rtc-wallet-glow-strong"
        );
      }, strongGlow ? 620 : 520);

      timeoutIdsRef.current.push(timeoutId);
    },
    [seatAnchorRefs]
  );

  const triggerTableImpact = useCallback(
    (strongGlow: boolean) => {
      const tableNode = tableRef.current;
      if (!tableNode) return;

      tableNode.classList.remove("rt-rtc-table-impact", "rt-rtc-table-impact-strong");
      void tableNode.offsetWidth;
      tableNode.classList.add(
        strongGlow ? "rt-rtc-table-impact-strong" : "rt-rtc-table-impact"
      );

      const timeoutId = window.setTimeout(() => {
        tableNode.classList.remove("rt-rtc-table-impact", "rt-rtc-table-impact-strong");
      }, strongGlow ? 460 : 340);

      timeoutIdsRef.current.push(timeoutId);
    },
    [tableRef]
  );

  const spawnWalletPulse = useCallback((point: Point, strongGlow: boolean) => {
    const pulseId = createRtcId("rtc-pulse");
    setWalletPulses((current) => [
      ...current,
      { id: pulseId, x: point.x, y: point.y, strongGlow },
    ]);

    const timeoutId = window.setTimeout(() => {
      setWalletPulses((current) => current.filter((pulse) => pulse.id !== pulseId));
    }, strongGlow ? 700 : 520);

    timeoutIdsRef.current.push(timeoutId);
  }, []);

  const spawnFloatingText = useCallback((point: Point, text: string, strongGlow: boolean) => {
    const textId = createRtcId("rtc-text");
    setFloatingTexts((current) => [
      ...current,
      { id: textId, x: point.x, y: point.y, text, strongGlow },
    ]);

    const timeoutId = window.setTimeout(() => {
      setFloatingTexts((current) => current.filter((entry) => entry.id !== textId));
    }, 1200);

    timeoutIdsRef.current.push(timeoutId);
  }, []);

  const buildParticleVisual = useCallback(
    (
      model: RTCParticleModel,
      progressState: Omit<
        RTCParticleVisual,
        "id" | "asset" | "width" | "height" | "strongGlow"
      >
    ): RTCParticleVisual => {
      return {
        id: model.id,
        asset: model.asset,
        width: model.width,
        height: model.height,
        strongGlow: model.strongGlow,
        ...progressState,
      };
    },
    []
  );

  const startParticleAnimation = useCallback(
    (
      models: RTCParticleModel[],
      options: { isReem: boolean; winnerPoint: Point; totalWinAmount: number }
    ) => {
      clearScheduledWork();
      landingTriggeredIdsRef.current.clear();
      floatingTextShownRef.current = false;
      totalParticleCountRef.current = models.length;
      landingPitchStepRef.current = 0;

      const startedAt = performance.now();

      const updateFrame = (frameTime: number) => {
        const nextVisuals: RTCParticleVisual[] = [];

        models.forEach((model) => {
          const elapsed = frameTime - startedAt - model.delayMs;

          if (elapsed < 0) {
            nextVisuals.push(
              buildParticleVisual(model, {
                x: model.start.x,
                y: model.start.y,
                scale: 0.82,
                opacity: 0,
                rotation: model.rotationStart,
                blur: 1.1,
                glow: model.strongGlow ? 1.2 : 0.9,
              })
            );
            return;
          }

          let phaseTime = elapsed;
          const hasBurstStage = !!model.burstEnd && model.burstDurationMs > 0;

          if (hasBurstStage && model.burstEnd) {
            if (phaseTime < model.burstDurationMs) {
              const progress = clamp(phaseTime / model.burstDurationMs, 0, 1);
              const easedProgress = easeOutCubic(progress);
              const burstPoint = {
                x: lerp(model.start.x, model.burstEnd.x, easedProgress),
                y: lerp(model.start.y, model.burstEnd.y, easedProgress),
              };

              nextVisuals.push(
                buildParticleVisual(model, {
                  x: burstPoint.x,
                  y: burstPoint.y,
                  scale: 0.84 + 0.28 * Math.sin(progress * Math.PI * 0.9),
                  opacity: Math.min(1, progress * 1.5),
                  rotation: lerp(model.rotationStart, model.rotationMid, easedProgress),
                  blur: 1 - progress * 0.7,
                  glow: model.strongGlow ? 1.45 : 1.05,
                })
              );
              return;
            }

            phaseTime -= model.burstDurationMs;

            if (phaseTime < model.collapseDelayMs) {
              nextVisuals.push(
                buildParticleVisual(model, {
                  x: model.burstEnd.x,
                  y: model.burstEnd.y,
                  scale: 1.02,
                  opacity: 1,
                  rotation: model.rotationMid,
                  blur: 0.12,
                  glow: 1.45,
                })
              );
              return;
            }

            phaseTime -= model.collapseDelayMs;
          }

          const flightStart = model.burstEnd ?? model.start;
          if (phaseTime < model.flightDurationMs) {
            const progress = clamp(phaseTime / model.flightDurationMs, 0, 1);
            const easedProgress = easeInOutCubic(progress);
            const bezierPoint = quadraticBezier(
              flightStart,
              model.control,
              model.end,
              easedProgress
            );

            nextVisuals.push(
              buildParticleVisual(model, {
                x: bezierPoint.x,
                y: bezierPoint.y,
                scale: 0.88 + 0.27 * Math.sin(progress * Math.PI),
                opacity: Math.min(1, 0.25 + progress * 1.15),
                rotation: lerp(model.rotationMid, model.rotationEnd, easedProgress),
                blur: 0.7 * (1 - progress),
                glow: model.strongGlow ? 1.32 : 1.04,
              })
            );
            return;
          }

          phaseTime -= model.flightDurationMs;

          if (!landingTriggeredIdsRef.current.has(model.id) && winnerPlayerId) {
            landingTriggeredIdsRef.current.add(model.id);
            playLandingSound(model.strongGlow);
            spawnWalletPulse(model.end, model.strongGlow);
            triggerSeatImpact(winnerPlayerId, model.strongGlow);

            if (
              !floatingTextShownRef.current &&
              landingTriggeredIdsRef.current.size === totalParticleCountRef.current &&
              options.totalWinAmount > 0
            ) {
              floatingTextShownRef.current = true;
              spawnFloatingText(
                {
                  x: options.winnerPoint.x,
                  y: options.winnerPoint.y - (isPhoneLandscapeLayout ? 42 : 54),
                },
                `+${formatRTCAmount(options.totalWinAmount)}`,
                options.isReem
              );
            }
          }

          if (phaseTime < model.orbitDurationMs) {
            const progress = clamp(phaseTime / model.orbitDurationMs, 0, 1);
            const orbitAngle = model.orbitAngle + model.orbitTurns * Math.PI * 2 * progress;
            const orbitRadius = model.orbitRadius * (1 - 0.24 * progress);

            nextVisuals.push(
              buildParticleVisual(model, {
                x: model.end.x + Math.cos(orbitAngle) * orbitRadius,
                y: model.end.y + Math.sin(orbitAngle) * orbitRadius * 0.72,
                scale: 1.04 - progress * 0.08,
                opacity: 1,
                rotation: model.rotationEnd + progress * 24,
                blur: 0,
                glow: model.strongGlow ? 1.48 : 1.16,
              })
            );
            return;
          }

          phaseTime -= model.orbitDurationMs;

          if (phaseTime < model.absorbDurationMs) {
            const progress = clamp(phaseTime / model.absorbDurationMs, 0, 1);
            const easedProgress = easeInCubic(progress);
            const orbitStart = getOrbitStartPoint(model);

            nextVisuals.push(
              buildParticleVisual(model, {
                x: lerp(orbitStart.x, model.end.x, easedProgress),
                y: lerp(orbitStart.y, model.end.y, easedProgress),
                scale: 1 - easedProgress * 0.72,
                opacity: 1 - easedProgress,
                rotation: model.rotationEnd + easedProgress * 42,
                blur: 0,
                glow: model.strongGlow ? 1.18 : 0.88,
              })
            );
          }
        });

        setParticles(nextVisuals);

        if (nextVisuals.length > 0) {
          animationFrameRef.current = window.requestAnimationFrame(updateFrame);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = window.requestAnimationFrame(updateFrame);
    },
    [
      buildParticleVisual,
      clearScheduledWork,
      isPhoneLandscapeLayout,
      playLandingSound,
      spawnFloatingText,
      spawnWalletPulse,
      triggerSeatImpact,
      winnerPlayerId,
    ]
  );

  useEffect(() => {
    if (
      gameState.mode === "USD_CONTEST" ||
      gameState.mode === "PRIVATE_USD_TABLE" ||
      gameState.status !== "round-end" ||
      !winnerPlayerId
    ) {
      lastAnimationKeyRef.current = null;
      resetVisuals();
      return;
    }

    const animationKey = [
      gameState.tableId,
      gameState.roundEndedBy ?? "round-end",
      winnerPlayerId,
      gameState.lastAction?.timestamp ?? "no-action",
      payoutSignature,
    ].join(";");

    if (lastAnimationKeyRef.current === animationKey) {
      return;
    }

    lastAnimationKeyRef.current = animationKey;
    resetVisuals();

    const startAnimation = () => {
      const tableNode = tableRef.current;
      if (!tableNode) return;

      const winnerPoint = getRelativeAnchorPoint(winnerPlayerId);
      if (!winnerPoint) return;

      const transfers = roundTransferBlueprint
        .filter((transfer) => transfer.playerId !== winnerPlayerId)
        .map((transfer) => ({
          ...transfer,
          anchorPoint: getRelativeAnchorPoint(transfer.playerId),
        }))
        .filter(
          (transfer): transfer is { playerId: string; lossAmount: number; anchorPoint: Point } =>
            transfer.lossAmount > 0 && !!transfer.anchorPoint
        );

      if (transfers.length === 0) {
        return;
      }

      const tableWidth = tableNode.getBoundingClientRect().width;
      const tableHeight = tableNode.getBoundingClientRect().height;
      const tableCenter = { x: tableWidth / 2, y: tableHeight / 2 };
      const baseBillWidth = isPhoneLandscapeLayout ? 58 : 82;
      const isReem = gameState.roundEndedBy === "REEM";
      const winnerAmount = Math.max(
        0,
        Math.trunc(
          winnerRoundNet ??
            transfers.reduce((total, transfer) => total + transfer.lossAmount, 0)
        )
      );

      if (isReem) {
        setShowReemText(true);
        setScreenFlashKey((current) => current + 1);
        triggerTableImpact(true);
        playReemSound();

        const hideReemTextTimeout = window.setTimeout(() => {
          setShowReemText(false);
        }, 1100);
        timeoutIdsRef.current.push(hideReemTextTimeout);
      }

      const models: RTCParticleModel[] = [];

      if (isReem) {
        const radialBills = transfers.flatMap((transfer) => breakIntoRTC(transfer.lossAmount));
        const repeatedBills = radialBills.length > 0 ? radialBills : breakIntoRTC(winnerAmount);
        const burstCount = clamp(Math.max(20, repeatedBills.length || 20), 20, 28);

        for (let index = 0; index < burstCount; index += 1) {
          const denomination = repeatedBills[index % repeatedBills.length] ?? 1000;
          const sizeMultiplier = PARTICLE_SIZE_MULTIPLIER[denomination];
          const width = baseBillWidth * sizeMultiplier;
          const angle = (index / burstCount) * Math.PI * 2 + randomBetween(-0.18, 0.18);
          const radius = (isPhoneLandscapeLayout ? 86 : 122) + randomBetween(-18, 34);
          const burstEnd = {
            x: tableCenter.x + Math.cos(angle) * radius,
            y: tableCenter.y + Math.sin(angle) * radius * 0.72,
          };
          const end = withJitter(winnerPoint, isPhoneLandscapeLayout ? 16 : 22);
          const control = {
            x: (burstEnd.x + end.x) / 2 + randomBetween(-54, 54),
            y:
              Math.min(burstEnd.y, end.y) -
              randomBetween(
                isPhoneLandscapeLayout ? 74 : 102,
                isPhoneLandscapeLayout ? 118 : 164
              ),
          };

          models.push({
            id: createRtcId("rtc-reem"),
            denomination,
            asset: getRTCAsset(denomination),
            width,
            height: width * 0.56,
            start: withJitter(tableCenter, isPhoneLandscapeLayout ? 8 : 12),
            burstEnd,
            control,
            end,
            delayMs: 180 + index * 18,
            burstDurationMs: 260 + randomBetween(0, 50),
            collapseDelayMs: 130 + randomBetween(0, 40),
            flightDurationMs: 520 + randomBetween(20, 140),
            orbitDurationMs: 240 + randomBetween(20, 110),
            absorbDurationMs: 180 + randomBetween(20, 90),
            rotationStart: randomBetween(-18, 18),
            rotationMid: randomBetween(-46, 46),
            rotationEnd: randomBetween(-132, 132),
            orbitRadius: randomBetween(
              isPhoneLandscapeLayout ? 10 : 14,
              isPhoneLandscapeLayout ? 18 : 24
            ),
            orbitAngle: randomBetween(0, Math.PI * 2),
            orbitTurns: randomBetween(0.9, 1.45),
            strongGlow: true,
          });
        }
      } else {
        let sequenceIndex = 0;

        transfers.forEach((transfer, transferIndex) => {
          const denominations = breakIntoRTC(transfer.lossAmount);
          denominations.forEach((denomination) => {
            const sizeMultiplier = PARTICLE_SIZE_MULTIPLIER[denomination];
            const width = baseBillWidth * sizeMultiplier;
            const start = withJitter(transfer.anchorPoint, isPhoneLandscapeLayout ? 12 : 18);
            const end = withJitter(winnerPoint, isPhoneLandscapeLayout ? 14 : 20);
            const control = {
              x: (start.x + end.x) / 2 + randomBetween(-44, 44),
              y:
                Math.min(start.y, end.y) -
                randomBetween(
                  isPhoneLandscapeLayout ? 82 : 108,
                  isPhoneLandscapeLayout ? 126 : 176
                ),
            };

            models.push({
              id: createRtcId("rtc-bill"),
              denomination,
              asset: getRTCAsset(denomination),
              width,
              height: width * 0.56,
              start,
              control,
              end,
              delayMs: sequenceIndex * 40 + transferIndex * 70,
              burstDurationMs: 0,
              collapseDelayMs: 0,
              flightDurationMs: 640 + randomBetween(20, 160),
              orbitDurationMs: 220 + randomBetween(20, 120),
              absorbDurationMs: 180 + randomBetween(10, 90),
              rotationStart: randomBetween(-14, 14),
              rotationMid: randomBetween(-22, 22),
              rotationEnd: randomBetween(-92, 92),
              orbitRadius: randomBetween(
                isPhoneLandscapeLayout ? 8 : 12,
                isPhoneLandscapeLayout ? 16 : 22
              ),
              orbitAngle: randomBetween(0, Math.PI * 2),
              orbitTurns: randomBetween(0.85, 1.35),
              strongGlow: false,
            });

            sequenceIndex += 1;
          });
        });
      }

      if (models.length === 0) {
        return;
      }

      startParticleAnimation(models, {
        isReem,
        winnerPoint,
        totalWinAmount: winnerAmount,
      });
    };

    let retryCount = 0;
    const attemptStart = () => {
      const winnerPoint = winnerPlayerId ? getRelativeAnchorPoint(winnerPlayerId) : null;
      if (winnerPoint) {
        startAnimation();
        return;
      }

      if (retryCount >= 6) {
        return;
      }

      retryCount += 1;
      const timeoutId = window.setTimeout(() => {
        window.requestAnimationFrame(attemptStart);
      }, 90);
      timeoutIdsRef.current.push(timeoutId);
    };

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(attemptStart);
    });
    animationFrameRef.current = rafId;

    return () => {
      clearScheduledWork();
    };
  }, [
    clearScheduledWork,
    gameState.lastAction?.timestamp,
    gameState.mode,
    gameState.roundEndedBy,
    gameState.status,
    gameState.tableId,
    getRelativeAnchorPoint,
    isPhoneLandscapeLayout,
    payoutSignature,
    playReemSound,
    resetVisuals,
    roundTransferBlueprint,
    startParticleAnimation,
    tableRef,
    triggerTableImpact,
    winnerPlayerId,
    winnerRoundNet,
  ]);

  useEffect(() => {
    return () => {
      resetVisuals();
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, [resetVisuals]);

  if (gameState.mode === "USD_CONTEST" || gameState.mode === "PRIVATE_USD_TABLE") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      <AnimatePresence>
        {screenFlashKey > 0 ? (
          <motion.div
            key={`rtc-flash-${screenFlashKey}`}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,244,190,0.9),rgba(255,210,92,0.22)_38%,transparent_70%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.42, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showReemText ? (
          <motion.div
            key="rtc-reem-text"
            className="absolute left-1/2 top-[31%] z-[52] -translate-x-1/2 text-center"
            initial={{ opacity: 0, y: 12, scale: 0.82 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [12, 0, -6, -20],
              scale: [0.82, 1.08, 1.04, 0.96],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.05, ease: "easeOut" }}
          >
            <div
              className={`${isPhoneLandscapeLayout ? "text-[34px]" : "text-[56px]"} font-black uppercase tracking-[0.3em] text-amber-100 drop-shadow-[0_0_24px_rgba(255,215,64,0.9)]`}
              style={{ fontFamily: displayFont }}
            >
              REEM
            </div>
            <div
              className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[11px]"} mt-1 font-semibold uppercase tracking-[0.38em] text-yellow-100/92`}
            >
              RTC Burst
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {walletPulses.map((pulse) => (
          <motion.div
            key={pulse.id}
            className="absolute"
            style={{
              width: pulse.strongGlow ? 80 : 62,
              height: pulse.strongGlow ? 80 : 62,
              left: pulse.x,
              top: pulse.y,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{ opacity: [0, 0.75, 0], scale: [0.45, 1.18, 1.42] }}
            exit={{ opacity: 0 }}
            transition={{ duration: pulse.strongGlow ? 0.68 : 0.46, ease: "easeOut" }}
          >
            <div
              className={`h-full w-full rounded-full ${
                pulse.strongGlow
                  ? "bg-[radial-gradient(circle,rgba(255,245,186,0.95),rgba(255,211,76,0.28)_44%,transparent_72%)]"
                  : "bg-[radial-gradient(circle,rgba(255,244,190,0.88),rgba(255,215,90,0.22)_42%,transparent_72%)]"
              }`}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {floatingTexts.map((entry) => (
          <motion.div
            key={entry.id}
            className="absolute whitespace-nowrap font-bold"
            style={{
              left: entry.x,
              top: entry.y,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ opacity: 0, y: 10, scale: 0.86 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [10, -6, -18, -34],
              scale: [0.86, 1, 1.04, 1.02],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.12, ease: "easeOut" }}
          >
            <div
              className={`${isPhoneLandscapeLayout ? "text-[15px]" : "text-[22px]"} ${
                entry.strongGlow
                  ? "text-yellow-100 drop-shadow-[0_0_20px_rgba(255,215,64,0.95)]"
                  : "text-[#ffd659] drop-shadow-[0_0_14px_rgba(255,215,64,0.82)]"
              }`}
            >
              {entry.text}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute will-change-transform"
          style={{
            width: particle.width,
            height: particle.height,
            opacity: particle.opacity,
            transform: `translate3d(${particle.x - particle.width / 2}px, ${particle.y - particle.height / 2}px, 0) rotate(${particle.rotation}deg) scale(${particle.scale})`,
            transformOrigin: "center",
            filter: `drop-shadow(0 0 ${particle.strongGlow ? 16 : 10}px rgba(255,215,0,${particle.strongGlow ? 0.88 : 0.62})) blur(${particle.blur}px) saturate(${1 + particle.glow * 0.08})`,
          }}
        >
          <img
            src={particle.asset}
            alt=""
            aria-hidden="true"
            className="h-full w-full select-none object-contain"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
};

export default RtcParticleOverlay;
