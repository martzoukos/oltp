"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  className,
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children?: React.ReactNode; // visible text turns it into an outline button
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      type="button"
      variant={children ? "outline" : "ghost"}
      size={children ? "xs" : "icon-sm"}
      aria-label={label}
      className={cn(
        !children && "size-6 text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {children}
    </Button>
  );
}
