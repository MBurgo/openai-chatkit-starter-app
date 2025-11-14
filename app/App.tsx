"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function App() {
  const { scheme, setScheme } = useColorScheme();

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
    <main className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-8 text-slate-50">
      <div className="w-full max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Burgo&apos;s Foolish Theme Generator
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Press &quot;Start&quot; to kick off the agent, then refine the
            output with follow‑up questions.
          </p>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg">
          <ChatKitPanel
            theme={scheme}
            onWidgetAction={handleWidgetAction}
            onResponseEnd={handleResponseEnd}
            onThemeRequest={setScheme}
          />
        </section>
      </div>
    </main>
  );
}
