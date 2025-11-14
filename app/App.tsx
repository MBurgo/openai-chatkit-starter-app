// app/App.tsx
"use client";

import { useCallback, useState } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [showChat, setShowChat] = useState(false);

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Page header */}
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">
            Burgo&apos;s Foolish Theme Generator
          </h1>
          <p className="text-sm opacity-80">
            When you hit Start, a multi-agent process will be kicked off. First, a Futurist agent scans emerging trends and technologies worldwide, then ranks the themes that may be of most interest to Australian investors, based on our defined personas. Next, a senior copy chief agent turns the top theme into a complete campaign: a three‑email launch sequence plus a long‑form order page.
          </p>
        </header>

        {/* Start button shown before ChatKit is visible */}
        {!showChat && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="rounded-full border border-slate-700 px-6 py-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100 dark:border-slate-300 dark:text-slate-50 dark:hover:bg-slate-800"
            >
              Start
            </button>
          </div>
        )}

        {/* ChatKit mounts only after Start is clicked.
            autoStartText tells ChatKitPanel to send the first message for you. */}
        {showChat && (
          <ChatKitPanel
            theme={scheme}
            onWidgetAction={handleWidgetAction}
            onResponseEnd={handleResponseEnd}
            onThemeRequest={setScheme}
            autoStartText="Start"
          />
        )}
      </div>
    </main>
  );
}
