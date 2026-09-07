import { ReactNode } from "react";
import PublicHeader from "./PublicHeader";

type Props = {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
};

export default function LegalPageLayout({ eyebrow, title, updated, children }: Props) {
  return (
    <main className="min-h-screen bg-board">
      <PublicHeader />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-moss mb-2">{eyebrow}</p>
        <h1 className="font-display text-3xl font-semibold mb-2">{title}</h1>
        <p className="text-xs text-ink/70 mb-8">Last updated {updated}</p>
        <div className="flex flex-col gap-4 text-sm text-ink/80 leading-relaxed">{children}</div>
      </div>
    </main>
  );
}
