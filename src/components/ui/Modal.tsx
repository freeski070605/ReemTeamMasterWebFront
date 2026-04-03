import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm overscroll-contain [-webkit-overflow-scrolling:touch]">
      <div className="flex min-h-full items-start justify-center p-3 pt-[max(0.75rem,var(--safe-area-top))] pb-[max(0.75rem,var(--safe-area-bottom))] sm:items-center sm:p-4">
        <Card className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0f1218]/95 shadow-[0_25px_60px_rgba(0,0,0,0.45)] max-h-[calc(var(--app-height)-1.5rem-var(--safe-area-top)-var(--safe-area-bottom))] sm:max-h-[min(44rem,calc(var(--app-height)-2rem-var(--safe-area-top)-var(--safe-area-bottom)))]">
          <div className="border-b border-white/10 px-4 py-4 sm:px-6">
            <h2 className="text-xl font-semibold text-white rt-page-title sm:text-2xl">{title}</h2>
          </div>
          <div className="overflow-y-auto px-4 py-4 text-sm text-white/75 [-webkit-overflow-scrolling:touch] sm:px-6">
            {children}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 bg-[#0f1218]/98 px-4 py-4 sm:px-6">
            <Button onClick={onClose} variant="secondary">
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
