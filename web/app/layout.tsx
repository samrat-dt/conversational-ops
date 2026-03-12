import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conversational Ops',
  description: 'GitHub Issues as DB, LLM as parser, CLI/Web/Slack as UI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
