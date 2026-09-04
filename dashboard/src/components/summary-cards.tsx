'use client';

import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { CheckCircle2, XCircle, AlertTriangle, BarChart3 } from 'lucide-react';

interface SummaryCardsProps {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

function ProgressRing({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width="88" height="88" className="transform -rotate-90">
      <circle
        cx="44"
        cy="44"
        r="38"
        fill="none"
        stroke="currentColor"
        className="text-gray-100"
        strokeWidth="6"
      />
      <circle
        cx="44"
        cy="44"
        r="38"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
        style={{ animation: 'progressRing 1s ease-out forwards' }}
      />
    </svg>
  );
}

const items = [
  {
    key: 'total',
    label: 'Total de PDPs',
    icon: BarChart3,
    color: '#2563eb',
    bgGradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-l-blue-500',
  },
  {
    key: 'passed',
    label: 'Passou',
    icon: CheckCircle2,
    color: '#059669',
    bgGradient: 'from-emerald-50 to-green-50',
    borderColor: 'border-l-emerald-500',
  },
  {
    key: 'failed',
    label: 'Falhou',
    icon: XCircle,
    color: '#dc2626',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-l-red-500',
  },
  {
    key: 'errors',
    label: 'Erros',
    icon: AlertTriangle,
    color: '#d97706',
    bgGradient: 'from-amber-50 to-yellow-50',
    borderColor: 'border-l-amber-500',
  },
] as const;

export function SummaryCards({ total, passed, failed, errors }: SummaryCardsProps) {
  const values = { total, passed, failed, errors };
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Main progress indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white border-0 shadow-lg shadow-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Taxa de aprovação</p>
              <p className="text-4xl font-bold mt-1">{passRate}%</p>
              <p className="text-indigo-200 text-xs mt-2">
                {passed} de {total} PDPs passaram em todas as verificações
              </p>
            </div>
            <div className="relative">
              <ProgressRing value={passed} max={total} color="#a5b4fc" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">
                  {passed}/{total}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Detail cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <Card
                className={`border-l-4 ${item.borderColor} bg-linear-to-br ${item.bgGradient} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/60 shadow-sm">
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: item.color }}>
                      {values[item.key]}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">{item.label}</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
