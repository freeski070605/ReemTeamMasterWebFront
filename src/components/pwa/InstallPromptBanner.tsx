import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";

type InstallPromptUserChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallPromptUserChoice>;
};

const INSTALL_BANNER_HIDE_UNTIL_KEY = "rt_install_banner_hide_until";
const INSTALL_BANNER_INSTALLED_KEY = "rt_install_banner_installed";
const INSTALL_BANNER_DISMISS_MS = 12 * 60 * 60 * 1000;

const getStoredNumber = (key: string): number => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStoredBoolean = (key: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
};

const isStandaloneDisplay = (): boolean => {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
};

type DeviceInfo = {
  isMobile: boolean;
  isIOS: boolean;
  isSafariOnIOS: boolean;
};

const getDeviceInfo = (): DeviceInfo => {
  const userAgent = window.navigator.userAgent;
  const ua = userAgent.toLowerCase();
  const isTouchMac = /macintosh/.test(ua) && window.navigator.maxTouchPoints > 1;
  const isIOS = /iphone|ipad|ipod/.test(ua) || isTouchMac;
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opr\//.test(ua);
  const isMobile =
    window.matchMedia("(max-width: 1024px)").matches ||
    window.matchMedia("(pointer: coarse)").matches ||
    /android|iphone|ipad|ipod|mobile/.test(ua);

  return {
    isMobile,
    isIOS,
    isSafariOnIOS: isIOS && isSafari,
  };
};

const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPromptingInstall, setIsPromptingInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandaloneDisplay());
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());
  const [hideUntil, setHideUntil] = useState<number>(() => getStoredNumber(INSTALL_BANNER_HIDE_UNTIL_KEY));
  const [isMarkedInstalled, setIsMarkedInstalled] = useState<boolean>(() =>
    getStoredBoolean(INSTALL_BANNER_INSTALLED_KEY)
  );

  useEffect(() => {
    const refreshEnvironment = () => {
      setIsStandalone(isStandaloneDisplay());
      setDeviceInfo(getDeviceInfo());
    };

    const displayModeMediaQuery = window.matchMedia("(display-mode: standalone)");
    refreshEnvironment();

    window.addEventListener("resize", refreshEnvironment, { passive: true });
    window.addEventListener("orientationchange", refreshEnvironment, { passive: true });
    if (typeof displayModeMediaQuery.addEventListener === "function") {
      displayModeMediaQuery.addEventListener("change", refreshEnvironment);
    } else {
      displayModeMediaQuery.addListener(refreshEnvironment);
    }

    return () => {
      window.removeEventListener("resize", refreshEnvironment);
      window.removeEventListener("orientationchange", refreshEnvironment);
      if (typeof displayModeMediaQuery.removeEventListener === "function") {
        displayModeMediaQuery.removeEventListener("change", refreshEnvironment);
      } else {
        displayModeMediaQuery.removeListener(refreshEnvironment);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const handleAppInstalled = () => {
      window.localStorage.setItem(INSTALL_BANNER_INSTALLED_KEY, "true");
      setIsMarkedInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissForNow = (durationMs = INSTALL_BANNER_DISMISS_MS) => {
    const nextHideUntil = Date.now() + durationMs;
    setHideUntil(nextHideUntil);
    window.localStorage.setItem(INSTALL_BANNER_HIDE_UNTIL_KEY, String(nextHideUntil));
  };

  const markInstalled = () => {
    setIsMarkedInstalled(true);
    window.localStorage.setItem(INSTALL_BANNER_INSTALLED_KEY, "true");
  };

  const installMode = useMemo<"android" | "ios" | null>(() => {
    const suppressed = isMarkedInstalled || hideUntil > Date.now();
    if (suppressed || isStandalone || !deviceInfo.isMobile) {
      return null;
    }
    if (deferredPrompt) {
      return "android";
    }
    if (deviceInfo.isIOS) {
      return "ios";
    }
    return null;
  }, [deferredPrompt, deviceInfo.isIOS, deviceInfo.isMobile, hideUntil, isMarkedInstalled, isStandalone]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt || isPromptingInstall) return;

    setIsPromptingInstall(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        markInstalled();
      } else {
        dismissForNow();
      }
    } catch {
      dismissForNow();
    } finally {
      setDeferredPrompt(null);
      setIsPromptingInstall(false);
    }
  };

  if (!installMode) {
    return null;
  }

  const iOSInstallMessage = deviceInfo.isSafariOnIOS
    ? "In Safari tap Share, then Add to Home Screen."
    : "Open this site in Safari, then tap Share and Add to Home Screen.";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] md:hidden"
      style={{
        paddingLeft: "calc(var(--safe-area-left) + 12px)",
        paddingRight: "calc(var(--safe-area-right) + 12px)",
        paddingBottom: "calc(var(--safe-area-bottom) + 12px)",
      }}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-amber-300/35 bg-[#0f141b]/96 p-3 shadow-[0_14px_32px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/85">Install ReemTeam App</div>
            <div className="mt-1 text-sm font-semibold text-white">Play full-screen without browser bars.</div>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => dismissForNow()}
          >
            Later
          </button>
        </div>

        <div className="mt-2 text-xs text-white/75">
          {installMode === "android"
            ? "Install now for faster launch and cleaner table view."
            : iOSInstallMessage}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {installMode === "android" ? (
            <>
              <Button size="sm" onClick={handleAndroidInstall} isLoading={isPromptingInstall}>
                Install
              </Button>
              <Button variant="secondary" size="sm" onClick={() => dismissForNow()}>
                Not now
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => dismissForNow()}>
                Got it
              </Button>
              <Button variant="secondary" size="sm" onClick={markInstalled}>
                Already installed
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPromptBanner;
