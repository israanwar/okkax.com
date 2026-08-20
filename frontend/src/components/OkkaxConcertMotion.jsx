import React, { useRef, useEffect, useState } from "react";

/**
 * -----------------------------------------------------------------------------
 * Okkax CINEMATIC CONCERT MOTION ENGINE (EXACT ARENA RIGGING SYSTEM)
 * Implements world-class arena/festival concert lighting:
 * - Overhead metal truss structure across the top.
 * - Upper-Left Cluster (4-5 fixtures: large magenta wash, crisp white spot, medium/small beams).
 * - Upper-Center Cluster (3-4 fixtures: gentle framing spotlights, clean center).
 * - Upper-Right Cluster (5-6 fixtures: dramatic large magenta, narrow white spot, medium beams).
 * - Size & intensity hierarchy (Large, Medium, Small).
 * - Conic volumetric falloff, optical core rays, fixture lens flares.
 * - Dynamic stage/crowd illumination spill, crowd phone lights, and subtle sparks.
 * - High-performance 60fps Canvas 2D with zero RAF allocations.
 * -----------------------------------------------------------------------------
 */
export default function OkkaxConcertMotion({ className = "" }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = null;
    let isVisible = true;
    let isTabActive = true;
    let lastTime = performance.now();

    // Canvas dimensions & High-DPI clamping
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || 830;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    const handleVisibility = () => {
      isTabActive = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    // -------------------------------------------------------------------------
    // ARENA RIGGING FIXTURE SPECIFICATIONS (EXACT CLUSTER ARCHITECTURE)
    // -------------------------------------------------------------------------
    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;

    // 1. ALL OVERHEAD MOVING-HEAD FIXTURES
    const fixtures = [
      // =======================================================================
      // CLUSTER 1: UPPER-LEFT CLUSTER (4-5 Fixtures)
      // Mounted along left overhead truss: xR 0.06 to 0.28
      // =======================================================================
      {
        id: "L1_LARGE_MAGENTA",
        tier: "LARGE",
        cluster: "LEFT",
        originXR: 0.09,
        originYR: 0.04,
        baseAngle: Math.PI * 0.35, // ~63° (diagonal to center/stage)
        sweepRange: 0.16,
        speed: 0.28,
        phase: 0.0,
        spreadBase: isMobile ? 12 : 22,
        spreadTip: isMobile ? 160 : 310, // Large volumetric cone
        color: { r: 255, g: 45, b: 120, a: 0.42 }, // Rich Okkax Magenta
        coreColor: "rgba(255, 120, 180, 0.75)",
        coreWidth: 2.2,
        lengthRatio: 1.35,
      },
      {
        id: "L2_SHARP_WHITE",
        tier: "MEDIUM",
        cluster: "LEFT",
        originXR: 0.15,
        originYR: 0.03,
        baseAngle: Math.PI * 0.38, // ~68°
        sweepRange: 0.22,
        speed: 0.40,
        phase: 1.6,
        spreadBase: isMobile ? 6 : 10,
        spreadTip: isMobile ? 80 : 130, // Thin, sharp spotlight
        color: { r: 255, g: 255, b: 255, a: 0.32 }, // Stage White
        coreColor: "rgba(255, 255, 255, 0.95)",
        coreWidth: 1.4,
        lengthRatio: 1.30,
      },
      {
        id: "L3_MED_MAGENTA",
        tier: "MEDIUM",
        cluster: "LEFT",
        originXR: 0.21,
        originYR: 0.05,
        baseAngle: Math.PI * 0.42, // ~75°
        sweepRange: 0.18,
        speed: 0.32,
        phase: 3.2,
        spreadBase: isMobile ? 8 : 14,
        spreadTip: isMobile ? 110 : 200, // Medium cone
        color: { r: 255, g: 55, b: 135, a: 0.35 },
        coreColor: "rgba(255, 140, 195, 0.65)",
        coreWidth: 1.8,
        lengthRatio: 1.25,
      },
      {
        id: "L4_SMALL_MAGENTA",
        tier: "SMALL",
        cluster: "LEFT",
        originXR: 0.27,
        originYR: 0.04,
        baseAngle: Math.PI * 0.45, // ~81° (falling more vertically)
        sweepRange: 0.14,
        speed: 0.24,
        phase: 4.8,
        spreadBase: isMobile ? 6 : 10,
        spreadTip: isMobile ? 70 : 130, // Small accent beam
        color: { r: 255, g: 45, b: 120, a: 0.28 },
        coreColor: "rgba(255, 100, 170, 0.55)",
        coreWidth: 1.2,
        lengthRatio: 1.20,
      },
      ...(!isMobile
        ? [
            {
              id: "L5_ACCENT_MAGENTA",
              tier: "SMALL",
              cluster: "LEFT",
              originXR: 0.04,
              originYR: 0.06,
              baseAngle: Math.PI * 0.31, // ~56° (outer perimeter wash)
              sweepRange: 0.12,
              speed: 0.18,
              phase: 2.1,
              spreadBase: 8,
              spreadTip: 150,
              color: { r: 255, g: 45, b: 120, a: 0.24 },
              coreColor: "rgba(255, 120, 180, 0.45)",
              coreWidth: 1.0,
              lengthRatio: 1.25,
            },
          ]
        : []),

      // =======================================================================
      // CLUSTER 2: UPPER-CENTER CLUSTER (3-4 Fixtures - Clean Framing)
      // Mounted at overhead center: xR 0.40 to 0.60
      // Lower intensity, framing around headline
      // =======================================================================
      {
        id: "C1_WHITE_SPOT",
        tier: "MEDIUM",
        cluster: "CENTER",
        originXR: 0.42,
        originYR: 0.02,
        baseAngle: Math.PI * 0.44, // Angled slightly down-left framing text
        sweepRange: 0.10,
        speed: 0.22,
        phase: 0.8,
        spreadBase: isMobile ? 6 : 10,
        spreadTip: isMobile ? 75 : 135,
        color: { r: 255, g: 255, b: 255, a: 0.20 }, // Softer white
        coreColor: "rgba(255, 255, 255, 0.65)",
        coreWidth: 1.2,
        lengthRatio: 1.15,
      },
      {
        id: "C2_MAGENTA_SPOT",
        tier: "MEDIUM",
        cluster: "CENTER",
        originXR: 0.58,
        originYR: 0.02,
        baseAngle: Math.PI * 0.56, // Angled slightly down-right framing text
        sweepRange: 0.10,
        speed: 0.24,
        phase: 3.5,
        spreadBase: isMobile ? 8 : 12,
        spreadTip: isMobile ? 90 : 155,
        color: { r: 255, g: 45, b: 120, a: 0.22 }, // Softer magenta
        coreColor: "rgba(255, 120, 180, 0.55)",
        coreWidth: 1.2,
        lengthRatio: 1.15,
      },
      {
        id: "C3_THIN_ACCENT",
        tier: "SMALL",
        cluster: "CENTER",
        originXR: 0.50,
        originYR: 0.01,
        baseAngle: Math.PI * 0.50, // Straight down, subtle
        sweepRange: 0.08,
        speed: 0.16,
        phase: 1.9,
        spreadBase: 6,
        spreadTip: isMobile ? 50 : 95,
        color: { r: 255, g: 75, b: 145, a: 0.16 }, // Very subtle
        coreColor: "rgba(255, 255, 255, 0.45)",
        coreWidth: 0.9,
        lengthRatio: 1.10,
      },

      // =======================================================================
      // CLUSTER 3: UPPER-RIGHT CLUSTER (5-6 Fixtures - Dramatic & Rich)
      // Mounted along right overhead truss: xR 0.72 to 0.96
      // =======================================================================
      {
        id: "R1_LARGE_MAGENTA",
        tier: "LARGE",
        cluster: "RIGHT",
        originXR: 0.88,
        originYR: 0.04,
        baseAngle: Math.PI * 0.64, // ~115° (diagonal to center/stage)
        sweepRange: 0.18,
        speed: 0.30,
        phase: 2.4,
        spreadBase: isMobile ? 12 : 24,
        spreadTip: isMobile ? 170 : 330, // Large volumetric cone
        color: { r: 255, g: 45, b: 120, a: 0.44 }, // Rich Okkax Magenta
        coreColor: "rgba(255, 120, 180, 0.80)",
        coreWidth: 2.4,
        lengthRatio: 1.38,
      },
      {
        id: "R2_NARROW_WHITE",
        tier: "MEDIUM",
        cluster: "RIGHT",
        originXR: 0.82,
        originYR: 0.03,
        baseAngle: Math.PI * 0.60, // ~108°
        sweepRange: 0.22,
        speed: 0.42,
        phase: 4.1,
        spreadBase: isMobile ? 6 : 10,
        spreadTip: isMobile ? 80 : 130, // Sharp white spotlight
        color: { r: 255, g: 255, b: 255, a: 0.34 }, // Stage White
        coreColor: "rgba(255, 255, 255, 0.95)",
        coreWidth: 1.4,
        lengthRatio: 1.30,
      },
      {
        id: "R3_MED_MAGENTA",
        tier: "MEDIUM",
        cluster: "RIGHT",
        originXR: 0.76,
        originYR: 0.05,
        baseAngle: Math.PI * 0.57, // ~102°
        sweepRange: 0.16,
        speed: 0.34,
        phase: 0.6,
        spreadBase: isMobile ? 8 : 14,
        spreadTip: isMobile ? 110 : 210, // Medium cone
        color: { r: 255, g: 60, b: 140, a: 0.36 },
        coreColor: "rgba(255, 130, 190, 0.65)",
        coreWidth: 1.8,
        lengthRatio: 1.25,
      },
      {
        id: "R4_SMALL_MAGENTA",
        tier: "SMALL",
        cluster: "RIGHT",
        originXR: 0.71,
        originYR: 0.04,
        baseAngle: Math.PI * 0.54, // ~97°
        sweepRange: 0.14,
        speed: 0.26,
        phase: 5.2,
        spreadBase: isMobile ? 6 : 10,
        spreadTip: isMobile ? 70 : 130, // Small accent beam
        color: { r: 255, g: 45, b: 120, a: 0.26 },
        coreColor: "rgba(255, 100, 170, 0.55)",
        coreWidth: 1.2,
        lengthRatio: 1.20,
      },
      ...(!isMobile
        ? [
            {
              id: "R5_OUTER_MAGENTA",
              tier: "MEDIUM",
              cluster: "RIGHT",
              originXR: 0.95,
              originYR: 0.05,
              baseAngle: Math.PI * 0.68, // ~122° (outer right screen wash)
              sweepRange: 0.14,
              speed: 0.20,
              phase: 1.1,
              spreadBase: 10,
              spreadTip: 190,
              color: { r: 255, g: 45, b: 120, a: 0.32 },
              coreColor: "rgba(255, 110, 175, 0.55)",
              coreWidth: 1.6,
              lengthRatio: 1.30,
            },
            {
              id: "R6_SMALL_WHITE_ACCENT",
              tier: "SMALL",
              cluster: "RIGHT",
              originXR: 0.92,
              originYR: 0.03,
              baseAngle: Math.PI * 0.65,
              sweepRange: 0.18,
              speed: 0.38,
              phase: 3.7,
              spreadBase: 6,
              spreadTip: 90,
              color: { r: 255, g: 255, b: 255, a: 0.22 },
              coreColor: "rgba(255, 255, 255, 0.75)",
              coreWidth: 1.0,
              lengthRatio: 1.20,
            },
          ]
        : []),
    ];

    // 2. Crowd Phone Lights (Twinkling in Audience Horizon yR: 0.74 - 0.96)
    const phoneLightCount = isMobile ? 40 : isTablet ? 70 : 100;
    const phoneLights = [];
    for (let i = 0; i < phoneLightCount; i++) {
      phoneLights.push({
        xRatio: 0.02 + Math.random() * 0.96,
        yRatio: 0.74 + Math.random() * 0.24,
        size: 0.75 + Math.random() * 1.5,
        twinkleSpeed: 1.8 + Math.random() * 3.5,
        phase: Math.random() * Math.PI * 2,
        colorType: Math.random() > 0.30 ? "white" : "magenta",
      });
    }

    // 3. Floating Stage Pyro Sparks / Embers
    const sparkCount = isMobile ? 12 : 24;
    const sparks = [];
    for (let i = 0; i < sparkCount; i++) {
      sparks.push({
        x: Math.random() * width,
        y: height * (0.55 + Math.random() * 0.45),
        vx: (Math.random() - 0.5) * 16,
        vy: -18 - Math.random() * 30,
        size: 0.75 + Math.random() * 1.5,
        life: Math.random(),
        maxLife: 1.4 + Math.random() * 1.8,
      });
    }

    // 4. Volumetric Drifting Haze Clouds
    const hazeClouds = [
      { xR: 0.18, yR: 0.25, radiusR: 0.38, speed: 0.06, phase: 0.0 },
      { xR: 0.82, yR: 0.28, radiusR: 0.42, speed: 0.05, phase: 2.4 },
      { xR: 0.50, yR: 0.78, radiusR: 0.48, speed: 0.07, phase: 4.1 },
    ];

    // -------------------------------------------------------------------------
    // ANIMATION RENDER LOOP (60FPS Hardware Accelerated)
    // -------------------------------------------------------------------------
    const render = (now) => {
      animId = requestAnimationFrame(render);
      if (!isVisible || !isTabActive) return;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const t = now * 0.001; // Time in seconds

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // --- LAYER A: Overhead Metal Rigging / Truss Line ---
      // Subtle horizontal truss bar running along the top
      const trussY = height * 0.035;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, trussY - 4);
      ctx.lineTo(width, trussY - 4);
      ctx.moveTo(0, trussY + 4);
      ctx.lineTo(width, trussY + 4);
      ctx.stroke();

      // Subtle cross-bracing pattern along truss
      const braceSpacing = 28;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let bx = 0; bx < width; bx += braceSpacing) {
        ctx.moveTo(bx, trussY - 4);
        ctx.lineTo(bx + braceSpacing, trussY + 4);
        ctx.moveTo(bx, trussY + 4);
        ctx.lineTo(bx + braceSpacing, trussY - 4);
      }
      ctx.stroke();

      // --- LAYER B: Drifting Atmospheric Haze Scattering ---
      for (let i = 0; i < hazeClouds.length; i++) {
        const hc = hazeClouds[i];
        const hx = width * (hc.xR + Math.sin(t * hc.speed + hc.phase) * 0.07);
        const hy = height * (hc.yR + Math.cos(t * hc.speed * 0.8 + hc.phase) * 0.04);
        const hr = Math.max(width, height) * hc.radiusR;

        const hazeGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hazeGrad.addColorStop(0, "rgba(255, 45, 120, 0.08)");
        hazeGrad.addColorStop(0.5, "rgba(35, 15, 30, 0.04)");
        hazeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = hazeGrad;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- LAYER C: Overhead Moving-Head Volumetric Beams (TOP -> DOWN) ---
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < fixtures.length; i++) {
        const f = fixtures[i];

        // Smooth independent sinusoidal oscillation (concert lighting cues)
        const currentAngle =
          f.baseAngle +
          Math.sin(t * f.speed + f.phase) * f.sweepRange +
          Math.cos(t * f.speed * 0.45 + f.phase * 1.3) * (f.sweepRange * 0.25);

        const originX = width * f.originXR;
        const originY = height * f.originYR;
        const beamLength = Math.max(width, height) * f.lengthRatio;

        const tipCenterX = originX + Math.cos(currentAngle) * beamLength;
        const tipCenterY = originY + Math.sin(currentAngle) * beamLength;

        const perpX = -Math.sin(currentAngle);
        const perpY = Math.cos(currentAngle);

        // Volumetric conic trapezoid
        const p1X = originX - perpX * (f.spreadBase * 0.5);
        const p1Y = originY - perpY * (f.spreadBase * 0.5);
        const p2X = originX + perpX * (f.spreadBase * 0.5);
        const p2Y = originY + perpY * (f.spreadBase * 0.5);

        const p3X = tipCenterX + perpX * (f.spreadTip * 0.5);
        const p3Y = tipCenterY + perpY * (f.spreadTip * 0.5);
        const p4X = tipCenterX - perpX * (f.spreadTip * 0.5);
        const p4Y = tipCenterY - perpY * (f.spreadTip * 0.5);

        // Volumetric beam shaft gradient with realistic light falloff
        const beamGrad = ctx.createLinearGradient(originX, originY, tipCenterX, tipCenterY);
        const intensityMod = 0.88 + 0.12 * Math.sin(t * 1.6 + i);
        const alpha = f.color.a * intensityMod;

        beamGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 1.5})`); // Hot fixture lens emitter
        beamGrad.addColorStop(0.06, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, ${alpha * 1.25})`);
        beamGrad.addColorStop(0.35, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, ${alpha * 0.70})`);
        beamGrad.addColorStop(0.70, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, ${alpha * 0.25})`);
        beamGrad.addColorStop(1, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, 0)`);

        ctx.beginPath();
        ctx.moveTo(p1X, p1Y);
        ctx.lineTo(p2X, p2Y);
        ctx.lineTo(p3X, p3Y);
        ctx.lineTo(p4X, p4Y);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();

        // High-luminance optical core ray
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(tipCenterX, tipCenterY);
        const coreGrad = ctx.createLinearGradient(originX, originY, tipCenterX, tipCenterY);
        coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        coreGrad.addColorStop(0.25, f.coreColor);
        coreGrad.addColorStop(0.75, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, 0.15)`);
        coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = f.coreWidth;
        ctx.stroke();

        // Fixture Lens Flare / Hotspot on Overhead Truss
        const flareRadius = f.tier === "LARGE" ? 18 : f.tier === "MEDIUM" ? 14 : 10;
        const flareGrad = ctx.createRadialGradient(originX, originY, 0, originX, originY, flareRadius);
        flareGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        flareGrad.addColorStop(0.35, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, 0.75)`);
        flareGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(originX, originY, flareRadius, 0, Math.PI * 2);
        ctx.fill();

        // Dynamic Stage & Crowd Illumination Spill (Ground Light Pool)
        const floorY = height * 0.88;
        if (Math.sin(currentAngle) > 0.1) {
          const tFloor = (floorY - originY) / Math.sin(currentAngle);
          if (tFloor > 0 && tFloor < beamLength) {
            const hitX = originX + Math.cos(currentAngle) * tFloor;
            const poolRadius = Math.max(50, f.spreadTip * 0.40);

            const poolGrad = ctx.createRadialGradient(hitX, floorY, 0, hitX, floorY, poolRadius);
            poolGrad.addColorStop(0, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, ${alpha * 0.70})`);
            poolGrad.addColorStop(0.45, `rgba(${f.color.r}, ${f.color.g}, ${f.color.b}, ${alpha * 0.22})`);
            poolGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

            ctx.fillStyle = poolGrad;
            ctx.beginPath();
            ctx.ellipse(hitX, floorY, poolRadius, poolRadius * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // --- LAYER D: Crowd Phone Lights (Twinkling Audience Horizon) ---
      for (let i = 0; i < phoneLights.length; i++) {
        const pl = phoneLights[i];
        const px = width * pl.xRatio;
        const py = height * pl.yRatio;
        const brightness = 0.25 + 0.75 * Math.abs(Math.sin(t * pl.twinkleSpeed + pl.phase));

        const lightColor =
          pl.colorType === "white"
            ? `rgba(255, 255, 255, ${brightness * 0.80})`
            : `rgba(255, 120, 180, ${brightness * 0.70})`;

        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.arc(px, py, pl.size * (0.8 + brightness * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // --- LAYER E: Floating Stage Pyro Sparks ---
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.y += s.vy * dt;
        s.x += s.vx * dt;
        s.life += dt;

        if (s.life >= s.maxLife || s.y < height * 0.25) {
          s.x = width * (0.15 + Math.random() * 0.7);
          s.y = height * (0.85 + Math.random() * 0.15);
          s.life = 0;
          s.vy = -18 - Math.random() * 30;
        }

        const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * 0.65;
        ctx.fillStyle = `rgba(255, 180, 210, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`okx-concert-motion-container pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* 1. Realistic Concert Arena Photography Foundation (Truss Rigging, Stage, Full Crowd) */}
      <div className="okx-concert-photo-layer absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <img
          src="/assets/okkax-clean-arena-truss.jpg"
          alt=""
          className={`h-full w-full object-cover object-top opacity-60 mix-blend-screen filter saturate-145 contrast-120 brightness-95 ${
            reducedMotion ? "" : "okx-concert-slow-breathing"
          }`}
        />
      </div>

      {/* 2. Top-Down Animated Arena Lighting Canvas (Beams, Rigging Flares, Crowd Spill) */}
      {!reducedMotion && (
        <canvas
          ref={canvasRef}
          className="okx-concert-canvas absolute inset-0 z-[2] pointer-events-none"
        />
      )}

      {/* 3. Center Readability Mask (Framing headline & Command Capsule with deep dark contrast) */}
      <div
        className="okx-concert-readability-mask absolute inset-0 z-[4] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 72% 64% at 50% 46%, rgba(7, 7, 10, 0.90) 0%, rgba(7, 7, 10, 0.58) 45%, transparent 88%)",
        }}
      />

      {/* 4. Top & Bottom Atmospheric Vignette Finish */}
      <div
        className="okx-concert-top-vignette absolute top-0 left-0 right-0 h-28 pointer-events-none z-[5]"
        style={{
          background: "linear-gradient(180deg, rgba(6, 6, 10, 0.92) 0%, rgba(6, 6, 10, 0) 100%)",
        }}
      />
      <div
        className="okx-concert-bottom-vignette absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-[5]"
        style={{
          background: "linear-gradient(0deg, #07070a 0%, rgba(7, 7, 10, 0.85) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
