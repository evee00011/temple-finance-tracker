import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Expense Tracker Lite',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-900 text-slate-100 flex flex-col justify-between">
        <div>
          <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-4">
              <a href="#" className="text-xl font-bold tracking-tight">
                <span className="text-amber-500">Expense and Collection</span> Tracker
                <span className="text-slate-400"></span>
              </a>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-8">
            {children}
          </main>
        </div>

        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500 w-full">
          Built with Next.js, Tailwind & Supabase
        </footer>
      </body>
    </html>
  );
}