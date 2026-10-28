import React from 'react';

interface MetricCardProps {
  label: string;
  value: number;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: 'blue' | 'slate' | 'green' | 'amber' | 'orange' | 'purple' | 'rose' | 'teal';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  isSelected = false,
  onClick,
  variant = 'blue'
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 border-blue-200',
      active: 'ring-2 ring-blue-500 bg-blue-100 border-blue-300',
      badge: 'bg-blue-600 text-white',
      accent: 'text-blue-700'
    },
    slate: {
      bg: 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200',
      active: 'ring-2 ring-slate-500 bg-slate-100 border-slate-300',
      badge: 'bg-slate-600 text-white',
      accent: 'text-slate-700'
    },
    green: {
      bg: 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 border-emerald-200',
      active: 'ring-2 ring-emerald-500 bg-emerald-100 border-emerald-300',
      badge: 'bg-emerald-600 text-white',
      accent: 'text-emerald-700'
    },
    amber: {
      bg: 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 border-amber-200',
      active: 'ring-2 ring-amber-500 bg-amber-100 border-amber-300',
      badge: 'bg-amber-600 text-white',
      accent: 'text-amber-700'
    },
    orange: {
      bg: 'bg-orange-50/70 hover:bg-orange-100/70 text-orange-900 border-orange-200',
      active: 'ring-2 ring-orange-500 bg-orange-100 border-orange-300',
      badge: 'bg-orange-600 text-white',
      accent: 'text-orange-700'
    },
    teal: {
      bg: 'bg-teal-50/70 hover:bg-teal-100/70 text-teal-900 border-teal-200',
      active: 'ring-2 ring-teal-500 bg-teal-100 border-teal-300',
      badge: 'bg-teal-600 text-white',
      accent: 'text-teal-700'
    },
    purple: {
      bg: 'bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 border-purple-200',
      active: 'ring-2 ring-purple-500 bg-purple-100 border-purple-300',
      badge: 'bg-purple-600 text-white',
      accent: 'text-purple-700'
    },
    rose: {
      bg: 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-900 border-rose-200',
      active: 'ring-2 ring-rose-500 bg-rose-100 border-rose-300',
      badge: 'bg-rose-600 text-white',
      accent: 'text-rose-700'
    }
  };

  const currentTheme = colorMap[variant] || colorMap.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full transition-all duration-150 p-4 rounded-xl border flex flex-col justify-between cursor-pointer shadow-sm ${
        currentTheme.bg
      } ${isSelected ? currentTheme.active : ''}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider opacity-80 block truncate mb-1">
        {label}
      </span>
      <div className="flex items-baseline justify-between mt-1">
        <span className={`text-2xl font-bold tracking-tight ${currentTheme.accent}`}>
          {value.toLocaleString('en-IN')}
        </span>
        <span className="text-xs text-slate-400 font-medium ml-2">Click to filter</span>
      </div>
    </button>
  );
};
