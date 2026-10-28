import React, { forwardRef } from "react";

/**
 * G360 Universal Button Component
 * Compliant with NUNITO + Apple HIG (44px touch targets on mobile)
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    className = "",
    disabled = false,
    loading = false,
    icon: Icon,
    type = "button",
    ...props
  },
  ref
) {
  const base =
    "inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer whitespace-nowrap active:scale-[0.98]";

  const variants = {
    primary:
      "bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm hover:shadow-md shadow-purple-500/20",
    secondary:
      "bg-slate-100 hover:bg-slate-200/90 text-slate-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-slate-100 border border-slate-200/80 dark:border-white/[0.08]",
    outline:
      "border border-slate-200/80 hover:border-[#7C3AED] text-slate-700 dark:border-white/[0.08] dark:text-slate-200 dark:hover:border-[#A78BFA] hover:text-[#7C3AED] dark:hover:text-[#A78BFA]",
    ghost:
      "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-sm",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
    subtle:
      "bg-[#7C3AED]/10 hover:bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA] dark:bg-[#7C3AED]/20",
  };

  const sizes = {
    sm: "h-9 px-3 text-xs rounded-xl gap-1.5",
    md: "h-11 px-4 text-[13px] rounded-xl gap-2 min-h-[44px]", // Apple HIG 44px min touch target
    lg: "h-12 px-6 text-sm rounded-2xl gap-2.5 min-h-[48px]",
    icon: "h-11 w-11 p-0 rounded-xl min-h-[44px] min-w-[44px] grid place-items-center",
    "icon-sm": "h-9 w-9 p-0 rounded-xl grid place-items-center",
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon size={size === "sm" ? 14 : 16} className="shrink-0" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
