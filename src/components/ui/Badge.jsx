import React from "react";

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className = "",
  icon: Icon,
  ...props
}) {
  const variants = {
    neutral:
      "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]",
    good:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40",
    warning:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40",
    critical:
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40",
    brand:
      "bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#7C3AED]/20 dark:text-[#A78BFA] border border-[#7C3AED]/20",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10.5px] gap-1",
    md: "px-2.5 py-1 text-[11.5px] gap-1.5",
    lg: "px-3.5 py-1.5 text-xs gap-2",
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full tracking-wide transition-colors ${
        variants[variant] || variants.neutral
      } ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === "sm" ? 11 : 13} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
