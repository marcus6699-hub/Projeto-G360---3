import React from "react";

export function SectionHeader({
  badge,
  title,
  description,
  actions,
  className = "",
  dark = false,
  ...props
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08] ${className}`}
      {...props}
    >
      <div className="space-y-1">
        {badge && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA] bg-[#7C3AED]/10 dark:bg-[#7C3AED]/20 px-2.5 py-0.5 rounded-full">
            {badge}
          </div>
        )}
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9D98B3] max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
