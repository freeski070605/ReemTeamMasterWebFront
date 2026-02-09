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
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm">
      <Card className="p-5 rounded-2xl border border-white/10 bg-black/80">
        <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
        <div className="text-white/70">{children}</div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </Card>
    </div>
  );
};
