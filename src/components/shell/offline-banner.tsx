"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/** UX-07: "Offline — will send when connected". */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-fg px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[13px] font-medium text-bg">
      <WifiOff className="size-4" aria-hidden />
      Offline — your drafts are saved and will send when connected
    </div>
  );
}
