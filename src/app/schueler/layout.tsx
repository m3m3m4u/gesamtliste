import React from 'react';
import QuizGate from '../QuizGate';

export default function SchuelerLayout({ children }: { children: React.ReactNode }) {
  return <QuizGate>{children}</QuizGate>;
}
