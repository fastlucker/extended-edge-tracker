import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extended Edge Tracker",
  description: "Know if you're ahead, average, or already late.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; background: #020817; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          input::placeholder { color: #334155; }
          input { caret-color: #0ea5e9; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
