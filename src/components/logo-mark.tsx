"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Academy mark: an open book, a lamp flame (shamma) rising from it, and a
 * leaf for growth — on the app's indigo. Same artwork as public/icon.svg.
 * `animated` plays the welcome-screen build (book → leaf → flame).
 */
export function LogoMark({ className, animated = false, plain = false }: { className?: string; animated?: boolean; plain?: boolean }) {
  // Unique gradient ids per instance: a hidden copy (display:none) earlier in the page would otherwise break the visible one.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (n: string) => `kms${uid}-${n}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-9", animated && "logo-animated", className)} aria-hidden>
      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f54de" />
          <stop offset="1" stopColor="#26267f" />
        </linearGradient>
        <linearGradient id={id("flame")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef0ff" />
          <stop offset="1" stopColor="#c9cdff" />
        </linearGradient>
        <linearGradient id={id("leaf")} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#14a06b" />
          <stop offset="1" stopColor="#6be3b0" />
        </linearGradient>
        <linearGradient id={id("page")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe2ff" />
        </linearGradient>
        <radialGradient id={id("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!plain && <rect width="64" height="64" rx="16" fill={`url(#${id("bg")})`} />}
      <circle cx="32.5" cy="27" r="17" fill={`url(#${id("halo")})`} className="logo-halo" />
      <g className="logo-leaf">
        <path d="M30.5 43.5C21.8 43.4 16.4 37.6 16.8 28.6c7.9.4 13.3 6.1 13.7 14.9z" fill={`url(#${id("leaf")})`} />
        <path d="M30.2 43c-2.9-5-6.6-9-11.6-12.4" stroke="#0b6e49" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
      </g>
      <g className="logo-flame">
        <path d="M33.2 9.5c1.4 6.2 8.8 10.6 8.8 19.6 0 6.3-4.4 10.9-10 10.9s-10-4.5-10-10.4c0-7.6 6.9-11.3 9.6-17.2.4 2.6 1.1 4.4 2.1 5.6.3-2.7.2-5.6-.5-8.5z" fill={`url(#${id("flame")})`} />
        <path d="M32 27.5c1.9 2.6 4.6 4.3 4.6 7.6 0 2.7-2 4.6-4.6 4.6s-4.6-1.9-4.6-4.6c0-3.3 2.7-5 4.6-7.6z" fill="#7b82f2" opacity="0.5" />
      </g>
      <g className="logo-book">
        <path d="M32 40.2v4.4" stroke="#dfe2ff" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M32 46.6c-5.6-3.7-12.2-4.7-19.2-3.5v8.6c7-1.2 13.6-.2 19.2 3.5z" fill={`url(#${id("page")})`} />
        <path d="M32 46.6c5.6-3.7 12.2-4.7 19.2-3.5v8.6c-7-1.2-13.6-.2-19.2 3.5z" fill={`url(#${id("page")})`} />
        <path
          d="M16.5 46.2c4.6-.6 8.6.1 12 1.9M16.5 49.4c4.6-.6 8.6.1 12 1.9M47.5 46.2c-4.6-.6-8.6.1-12 1.9M47.5 49.4c-4.6-.6-8.6.1-12 1.9"
          stroke="#c3c7f7"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

