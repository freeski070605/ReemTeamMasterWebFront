import React, { useEffect } from "react";

type GameLayoutProps = {
  children: React.ReactNode;
  backgroundImageUrl?: string;
  className?: string;
};

const syncAppHeight = () => {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
};

const GameLayout: React.FC<GameLayoutProps> = ({
  children,
  backgroundImageUrl,
  className = "",
}) => {
  useEffect(() => {
    const rootEl = document.documentElement;
    const bodyEl = document.body;

    rootEl.classList.add("game-route-active");
    bodyEl.classList.add("game-route-active");
    syncAppHeight();

    window.addEventListener("resize", syncAppHeight, { passive: true });
    window.addEventListener("orientationchange", syncAppHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", syncAppHeight);

    return () => {
      window.removeEventListener("resize", syncAppHeight);
      window.removeEventListener("orientationchange", syncAppHeight);
      window.visualViewport?.removeEventListener("resize", syncAppHeight);
      rootEl.classList.remove("game-route-active");
      bodyEl.classList.remove("game-route-active");
      rootEl.style.removeProperty("--app-height");
    };
  }, []);

  return (
    <section className={`game-fullscreen-root ${className}`}>
      {backgroundImageUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        />
      ) : null}
      <div className="game-fullscreen-content z-10">{children}</div>
    </section>
  );
};

export default GameLayout;
