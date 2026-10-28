import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * MetricCard component for KPI cards
 * Inspired by Vella + NUNITO dashboard metrics
 */
export function MetricCard({
  title,
  value,
  trend,
  trendDirection = "up",
  period = "vs. mês anterior",
  icon: Icon,
  accent = "#7C3AED",
  sparklineData = [],
  dark = false,
  className = "",
  ...props
}) {
  const cardStyle = dark
    ? "bg-[#14121E] border border-white/[0.08] text-[#EDE9FE] shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
    : "bg-white border border-slate-200/80 text-[#1A1033] shadow-[0_2px_12px_rgba(0,0,0,0.06)]";

  const isUp = trendDirection === "up";

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between ${cardStyle} ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9D98B3]">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-slate-100 tabular-nums">
            {value}
          </div>
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
            style={{
              backgroundColor: `${accent}15`,
              color: accent,
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
        {trend && (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                isUp
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
              }`}
            >
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend}
            </span>
            <span className="text-slate-400 dark:text-[#9D98B3] text-[11px]">{period}</span>
          </div>
        )}

        {sparklineData && sparklineData.length > 1 && (
          <svg className="w-16 h-6 overflow-visible shrink-0" viewBox="0 0 64 24">
            <path
              d={buildSparklinePath(sparklineData, 64, 24)}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function buildSparklinePath(data, width, height) {
  if (!data || data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const padding = 2;
  const usableH = height - padding * 2;

  return data
    .map((val, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - padding - ((val - min) / range) * usableH).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default MetricCard;
