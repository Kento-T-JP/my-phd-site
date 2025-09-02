"use client";

import { useEffect, useRef, useState } from "react";
import useClickSound from "@/lib/useClickSound";

interface MessageCellProps {
  message: string;
  className?: string;
}

/** Displays truncated text and opens a modal to show the full message when clicked */
export default function MessageCell({ message, className = "" }: MessageCellProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { play } = useClickSound();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      dialog?.showModal();
    } else {
      dialog?.close();
      triggerRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Escape") setOpen(false);
  };

  const handleClickOutside = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={`text-left w-full truncate underline ${className}`.trim()}
        onClick={() => {
          play();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label="全文を表示"
      >
        {message}
      </button>
      <dialog
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        onClick={handleClickOutside}
        className="rounded p-4 max-w-lg"
        aria-modal="true"
        role="dialog"
      >
        <p className="mb-4 whitespace-pre-wrap">{message}</p>
        <button
          onClick={() => {
            play();
            setOpen(false);
          }}
          className="bg-blue-500 text-white px-2 py-1 rounded"
        >
          Close
        </button>
      </dialog>
    </>
  );
}

