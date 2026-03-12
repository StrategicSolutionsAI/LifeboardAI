"use client";

import React, { lazy, Suspense, useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EmojiPicker = lazy(() =>
  import("@emoji-mart/react").then((mod) => ({ default: mod.default }))
);

type EmojiData = Record<string, unknown>;
let emojiDataPromise: Promise<EmojiData> | null = null;
function getEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import("@emoji-mart/data").then((mod) => mod.default as EmojiData);
  }
  return emojiDataPromise;
}

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  buttonHeight?: string;
  disabled?: boolean;
}

export function EmojiPickerButton({
  onEmojiSelect,
  buttonHeight = "h-7",
  disabled = false,
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<EmojiData | null>(null);

  const handleOpen = async (isOpen: boolean) => {
    if (isOpen && !data) {
      const d = await getEmojiData();
      setData(d);
    }
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={(v) => void handleOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`${buttonHeight} w-7 flex items-center justify-center rounded-md text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-brand-tint-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
          aria-label="Add emoji"
        >
          <Smile size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-0 shadow-warm-lg"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {data && (
          <Suspense fallback={<div className="h-[435px] w-[352px]" />}>
            <EmojiPicker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                onEmojiSelect(emoji.native);
                setOpen(false);
              }}
              theme="light"
              previewPosition="none"
              skinTonePosition="search"
              set="native"
            />
          </Suspense>
        )}
      </PopoverContent>
    </Popover>
  );
}
