import { useEffect, useRef, useCallback } from "react";

/* ── Dot grid canvas with mouse parallax ── */
function DotGrid({ mousePosRef }) {
  const canvasRef = useRef(null);
  const dotsRef  = useRef([]);
  const rafRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const SPACING = 16;
    const DOT_R   = 2.4;
    const COLOR   = "rgba(158, 112, 48, 0.14)";

    const buildGrid = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const cols = Math.ceil(canvas.width  / SPACING) + 2;
      const rows = Math.ceil(canvas.height / SPACING) + 2;
      dotsRef.current = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dotsRef.current.push({ bx: c * SPACING, by: r * SPACING, ox: 0, oy: 0 });
        }
      }
    };

    buildGrid();
    const ro = new ResizeObserver(buildGrid);
    ro.observe(canvas);

    const draw = () => {
      const { x: mx, y: my } = mousePosRef.current;
      const rect = canvas.getBoundingClientRect();
      /* rect.left/top shift with scroll — gives correct canvas-local coords */
      const cmx = mx - rect.left;
      const cmy = my - rect.top;

      const MAX_DRIFT = 6;
      const RADIUS    = 210;

      dotsRef.current.forEach((dot) => {
        const dx   = dot.bx - cmx;
        const dy   = dot.by - cmy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let tx = 0, ty = 0;
        if (dist < RADIUS && dist > 0) {
          const str = (1 - dist / RADIUS) * MAX_DRIFT;
          tx = (dx / dist) * str;
          ty = (dy / dist) * str;
        }
        dot.ox += (tx - dot.ox) * 0.07;
        dot.oy += (ty - dot.oy) * 0.07;
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLOR;
      dotsRef.current.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.bx + dot.ox, dot.by + dot.oy, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [mousePosRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: "block",
        zIndex: 0,
      }}
    />
  );
}

/* ── PageBackground wrapper ──────────────────────────────────────────────────
   Drop-in replacement for any page root div. Adds the animated dot grid and
   mouse-follow warm halo behind all children. Pass className / style as you
   would on the original div.
   ─────────────────────────────────────────────────────────────────────────── */
export default function PageBackground({ children, className, style }) {
  const containerRef = useRef(null);
  const gradientRef  = useRef(null);
  const mousePosRef  = useRef({ x: -9999, y: -9999 });

  const handleMouseMove = useCallback((e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    if (gradientRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      gradientRef.current.style.left = (e.clientX - rect.left) + "px";
      gradientRef.current.style.top  = (e.clientY - rect.top)  + "px";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePosRef.current = { x: -9999, y: -9999 };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", ...style }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dot grid canvas */}
      <DotGrid mousePosRef={mousePosRef} />

      {/* Mouse-follow warm cream halo */}
      <div
        ref={gradientRef}
        style={{
          position: "absolute",
          width: 408,
          height: 408,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(225, 200, 148, 0.36) 0%, rgba(235, 218, 178, 0.22) 42%, transparent 70%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          left: "50%",
          top: "50%",
          willChange: "left, top",
          zIndex: 0,
        }}
      />

      {/* Content sits above the effects */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
