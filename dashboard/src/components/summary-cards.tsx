"use client";

import { motion } from "framer-motion";
import { Card } from "./ui/card";

interface SummaryCardsProps {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

const items = [
  { key: "total", label: "Total de PDPs", color: "text-blue-600 border-l-blue-500" },
  { key: "passed", label: "Passou", color: "text-emerald-600 border-l-emerald-500" },
  { key: "failed", label: "Falhou", color: "text-red-600 border-l-red-500" },
  { key: "errors", label: "Erros", color: "text-amber-600 border-l-amber-500" },
] as const;

export function SummaryCards({ total, passed, failed, errors }: SummaryCardsProps) {
  const values = { total, passed, failed, errors };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className={`border-l-4 ${item.color.split(" ")[1]} text-center`}>
            <div className={`text-3xl font-bold ${item.color.split(" ")[0]}`}>
              {values[item.key]}
            </div>
            <div className="text-sm text-gray-500 mt-1">{item.label}</div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
