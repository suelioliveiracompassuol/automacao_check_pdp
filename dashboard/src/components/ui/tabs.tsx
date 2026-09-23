'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <RadixTabs.List
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-gray-100/80 p-1 w-fit',
        className,
      )}
    >
      {children}
    </RadixTabs.List>
  );
}

interface TabsTriggerProps {
  value: string;
  isActive: boolean;
  children: ReactNode;
  className?: string;
}

/** Radix trigger with a shared-layout indicator (`layoutId`) that slides between tabs instead of
 * popping, since active state must be known by the parent to drive the `motion.span`. */
export function TabsTrigger({ value, isActive, children, className }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative z-0 flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer outline-none',
        isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
        className,
      )}
    >
      {isActive && (
        <motion.span
          layoutId="tabs-active-indicator"
          className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      {children}
    </RadixTabs.Trigger>
  );
}
