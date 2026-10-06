'use client';

import { createContext, useContext } from 'react';
import type { Classroom } from '@/lib/types';

export const ClassContext = createContext<{ classroom: Classroom; isTeacher: boolean } | null>(null);

export const useClassContext = () => {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useClassContext must be used inside a class page');
  return ctx;
};
