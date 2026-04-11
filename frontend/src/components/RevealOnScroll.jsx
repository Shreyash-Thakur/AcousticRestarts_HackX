import { useEffect, useRef, useState } from "react";

/* ── RevealOnScroll ──────────────────────────────────────────────────────────
   Wraps any content and plays a fade + upward slide when it enters the
   viewport. Uses IntersectionObserver — no scroll library needed.

   Props:
     delay     — ms before the transition starts (default 0)
     y         — starting Y offset in px (default 20)
     threshold — how much of the element must be visible to trigger (default 0.12)
     style     — extra styles on the wrapper div
   ─────────────────────────────────────────────────────────────────────────── */
export default function RevealOnScroll({
  children,
  delay     = 0,
  y         = 20,
  threshold = 0.12,
  style,
}) {
  const ref     = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition: [
          `opacity 0.52s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
          `transform 0.52s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        ].join(", "),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
