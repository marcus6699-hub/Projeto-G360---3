import React from "react";

export function Card({ className = "", children, dark = false, ...props }) {
  const cardStyle = dark
    ? "bg-[#14121E] border border-white/[0.08] text-[#EDE9FE] shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
    : "bg-white border border-slate-200/80 text-[#1A1033] shadow-[0_2px_12px_rgba(0,0,0,0.06)]";

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${cardStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`p-5 sm:p-6 pb-3 border-b border-inherit ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3
      className={`text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p
      className={`text-xs sm:text-sm text-slate-500 dark:text-[#9D98B3] mt-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div
      className={`p-5 sm:p-6 pt-3 border-t border-inherit flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
