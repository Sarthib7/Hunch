"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Live countdown to a deadline; shows "closed" once it passes. */
export function Countdown({
  deadline,
  className,
}: {
  deadline: string;
  className?: string;
}) {
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {remaining <= 0 ? "closed" : format(remaining)}
    </span>
  );
}
