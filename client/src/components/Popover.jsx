import { useEffect, useRef } from "react";

/**
 * A panel anchored to the control that opened it.
 *
 * Used on desktop where a bottom sheet would feel detached from its trigger.
 * The parent must be positioned, since this places itself relative to it.
 */
export default function Popover({ open, onClose, children, className = "", width = "w-80" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      // The trigger handles its own toggle, so ignore clicks inside the
      // wrapper and only close on clicks genuinely outside.
      if (ref.current && !ref.current.parentElement?.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      className={`animate-popover absolute right-0 top-full z-[1000] mt-2 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift ${width} ${className}`}
    >
      {children}
    </div>
  );
}
