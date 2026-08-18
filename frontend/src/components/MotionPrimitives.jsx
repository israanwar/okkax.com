import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";

// -----------------------------------------------------------------------------
// EASINGS & TIMINGS (OKKAX Motion DNA: Restrained, Precise, Decisive)
// -----------------------------------------------------------------------------
export const OKX_EASE = [0.22, 1, 0.36, 1]; // Smooth luxury cubic-bezier
export const OKX_EASE_EDITORIAL = [0.16, 1, 0.3, 1]; // Editorial text reveal ease
export const OKX_EASE_FAST = [0.25, 1, 0.5, 1]; // Fast micro-interactions

// -----------------------------------------------------------------------------
// 1. REVEAL (Scroll Reveal for Single Components / Headings / Cards)
// Triggered once when approaching the viewport. Opacity + subtle translateY.
// -----------------------------------------------------------------------------
export function Reveal({
  children,
  className = "",
  delay = 0,
  duration = 0.65,
  y = 28,
  x = 0,
  scale = 1,
  once = true,
  as = "div",
  testId,
  ...rest
}) {
  const Component = motion[as] || motion.div;

  return (
    <Component
      initial={{ opacity: 0, y, x, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once, margin: "0px 0px -50px 0px" }}
      transition={{
        duration,
        delay,
        ease: OKX_EASE_EDITORIAL,
      }}
      className={className}
      data-testid={testId}
      {...rest}
    >
      {children}
    </Component>
  );
}

// -----------------------------------------------------------------------------
// 2. REVEAL GROUP & REVEAL ITEM (Staggered Group Reveal)
// For grids, lists, and participant cards to enter sequentially.
// -----------------------------------------------------------------------------
export function RevealGroup({
  children,
  className = "",
  stagger = 0.1,
  delay = 0,
  once = true,
  as = "div",
  testId,
  ...rest
}) {
  const Component = motion[as] || motion.div;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "0px 0px -40px 0px" }}
      variants={containerVariants}
      className={className}
      data-testid={testId}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function RevealItem({
  children,
  className = "",
  y = 24,
  duration = 0.6,
  as = "div",
  testId,
  ...rest
}) {
  const Component = motion[as] || motion.div;

  const itemVariants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: OKX_EASE_EDITORIAL,
      },
    },
  };

  return (
    <Component
      variants={itemVariants}
      className={className}
      data-testid={testId}
      {...rest}
    >
      {children}
    </Component>
  );
}

// -----------------------------------------------------------------------------
// 3. MASK REVEAL (Editorial Typography & Phrase-by-Phrase Reveal)
// Clean clip-path or line-by-line reveal without typewriter artifacting.
// -----------------------------------------------------------------------------
export function MaskReveal({
  children,
  className = "",
  delay = 0,
  duration = 0.75,
  as = "div",
  testId,
  ...rest
}) {
  const Component = motion[as] || motion.div;

  return (
    <div className={`overflow-hidden ${className}`} data-testid={testId}>
      <Component
        initial={{ y: "100%", opacity: 0 }}
        whileInView={{ y: "0%", opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -30px 0px" }}
        transition={{
          duration,
          delay,
          ease: OKX_EASE_EDITORIAL,
        }}
        {...rest}
      >
        {children}
      </Component>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. SCROLL PROGRESS (Minimalist Progress Line on Scroll)
// -----------------------------------------------------------------------------
export function ScrollProgressBar({ className = "" }) {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      style={{ scaleX: scrollYProgress, transformOrigin: "0% 50%" }}
      className={`fixed top-0 left-0 right-0 z-[100] h-[3px] bg-gradient-to-r from-[#ff2e7e] via-[#ff549a] to-[#ff7ab0] shadow-[0_0_12px_rgba(255,46,126,0.8)] pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}

// -----------------------------------------------------------------------------
// 5. HERO STAGE DEPTH MOTION (Linear + DICE Cinema Hero)
// Smoothly scales down background and elevates foreground on scroll.
// -----------------------------------------------------------------------------
export function HeroStageDepth({ imageSrc, alt, children, className = "" }) {
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 0.94]);
  const bgOpacity = useTransform(scrollYProgress, [0, 1], [0.86, 0.35]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -35]);

  return (
    <section
      ref={containerRef}
      className={`relative min-h-[640px] overflow-hidden border-b border-[var(--okx-border)] lg:min-h-[680px] ${className}`}
    >
      <motion.img
        src={imageSrc}
        alt={alt}
        style={{
          scale: isMobile ? 1 : bgScale,
          opacity: isMobile ? 0.86 : bgOpacity,
          willChange: "transform, opacity",
        }}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808e8] via-[46%] to-[#08080822]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#08080866]" />

      <motion.div
        style={{
          y: isMobile ? 0 : contentY,
          willChange: "transform",
        }}
        className="relative mx-auto flex min-h-[640px] max-w-[1440px] items-center px-4 py-16 sm:px-8 lg:min-h-[680px] lg:px-16"
      >
        {children}
      </motion.div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// 6. SPOTLIGHT LUMINESCENT CARD (Raycast/Linear Card Stage Lighting)
// -----------------------------------------------------------------------------
export function SpotlightCard({ children, className = "", spotlightColor = "rgba(255, 255, 255, 0.08)", ...rest }) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handlePointerMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hasExplicitOverflow = className.includes("overflow-");

  return (
    <div
      ref={divRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setOpacity(1)}
      onPointerLeave={() => setOpacity(0)}
      className={`group relative rounded-2xl border border-white/[0.08] bg-[#0c0c0e]/90 backdrop-blur-xl shadow-lg hover:border-white/25 hover:shadow-[0_20px_48px_rgba(0,0,0,0.85)] transition-all duration-300 ${hasExplicitOverflow ? "" : "overflow-hidden"} ${className}`}
      {...rest}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300 z-0 overflow-hidden"
        style={{
          opacity,
          background: `radial-gradient(450px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 7. COUNTER NUMBER (Velocity Odometer on Scroll)
// Rolls up numbers smoothly when entering the viewport.
// -----------------------------------------------------------------------------
export function CounterNumber({
  value,
  duration = 1.6,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const numericValue =
      typeof value === "number"
        ? value
        : parseFloat(String(value).replace(/[^0-9.-]+/g, "")) || 0;

    let startTime = null;
    let frameId;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      // Ease-out cubic curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = numericValue * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(numericValue);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [inView, value, duration]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString("id-ID");

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// -----------------------------------------------------------------------------
// 8. PROCESS CABLE RAIL (Laser Cable Fill across 4 Steps)
// -----------------------------------------------------------------------------
export function ProcessCableRail({ steps = [] }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });

  return (
    <div ref={ref} className="relative mt-10">
      {/* Desktop Animated Laser Line */}
      <div className="hidden lg:block absolute top-[68px] left-[20px] right-[20px] h-[2px] bg-zinc-800/80 pointer-events-none z-0">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{ transformOrigin: "0% 50%" }}
          className="h-full w-full bg-gradient-to-r from-[#ff2e7e] via-[#ff7ab0] to-emerald-400 shadow-[0_0_12px_rgba(255,46,126,0.85)]"
        />
      </div>

      <RevealGroup stagger={0.12} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 relative z-10">
        {steps.map(([Icon, title, body], i) => (
          <RevealItem key={title} className="relative border-t border-zinc-800 pt-7 lg:border-t-0 lg:pt-0">
            <div className="flex items-center justify-between">
              <span className="num text-xs font-semibold text-[var(--okx-accent)]">0{i + 1}</span>
              <Icon size={24} strokeWidth={1.6} className="text-[var(--okx-accent)]" aria-hidden="true" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <motion.span
                initial={{ scale: 0.6, borderColor: "#27272a" }}
                animate={inView ? { scale: 1, borderColor: "#ff2e7e" } : { scale: 0.6, borderColor: "#27272a" }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.25 }}
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-[#0d0d0d] shadow-[0_0_8px_rgba(255,46,126,0.6)]"
              />
              <span className="h-px flex-1 bg-zinc-800 lg:hidden" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-white md:text-lg">{title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{body}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 9. MOTION PANEL (Tab & Mode Transition Wrapper)
// Opacity + small translate 180-250ms for mode/tier/entity switches.
// -----------------------------------------------------------------------------
export function MotionPanel({
  children,
  activeKey,
  className = "",
  duration = 0.22,
  testId,
  ...rest
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 8, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.995 }}
        transition={{ duration, ease: OKX_EASE_FAST }}
        className={className}
        data-testid={testId}
        {...rest}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// 10. MOTION CARD (Tactile Lift on Hover)
// -----------------------------------------------------------------------------
export function MotionCard({
  children,
  className = "",
  testId,
  onClick,
  ...rest
}) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2, ease: OKX_EASE_FAST } }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      className={`transition-colors duration-200 ${className}`}
      data-testid={testId}
      onClick={onClick}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
