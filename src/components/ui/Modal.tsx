import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 rounded-2xl border border-white/15 bg-[#0f1218]/95 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <h2 className="text-2xl font-semibold mb-3 text-white rt-page-title">{title}</h2>
        <div className="text-white/75 text-sm">{children}</div>
        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </Card>
    </div>
  );
};
