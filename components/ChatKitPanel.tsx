// components/ChatKitPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
  /**
   * Optional text to send automatically as the first message
   * when the chat is ready (used by the Start button in App.tsx).
   */
  autoStartText?: string;
};

type ErrorState = {
  message: string | null;
};

type CreateSessionResponse = {
  client_secret?: string;
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  message: null,
});

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
  autoStartText,
}: ChatKitPanelProps) {
  const processedFacts = useRef<Set<string>>(new Set());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  const isMountedRef = useRef(true);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setErrorMessage = useCallback((message: string | null) => {
    setErrors({ message });
  }, []);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    hasAutoStartedRef.current = false;
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const isWorkflowConfigured =
    Boolean(WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace"));

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";

        if (isMountedRef.current) {
          setErrorMessage(detail);
          setIsInitializingSession(false);
        }

        throw new Error(detail);
      }

      if (isMountedRef.current) {
        if (!currentSecret) {
          setIsInitializingSession(true);
        }
        setErrorMessage(null);
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            chatkit_configuration: {
              // Enable attachments if your workflow supports them
              file_upload: {
                enabled: true,
              },
            },
          }),
        });

        const raw = await response.text();

        if (isDev) {
          console.info("[ChatKitPanel] createSession response", {
            status: response.status,
            ok: response.ok,
            bodyPreview: raw.slice(0, 1600),
          });
        }

        let data: CreateSessionResponse = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as CreateSessionResponse;
          } catch (parseError) {
            console.error(
              "Failed to parse create-session response",
              parseError
            );
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);

          console.error("Create session request failed", {
            status: response.status,
            body: data,
          });

          throw new Error(detail);
        }

        const clientSecret = data.client_secret;
        if (!clientSecret) {
          throw new Error("Missing client secret in response");
        }

        if (isMountedRef.current) {
          setErrorMessage(null);
        }

        return clientSecret;
      } catch (error) {
        console.error("Failed to create ChatKit session", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to start ChatKit session.";

        if (isMountedRef.current) {
          setErrorMessage(detail);
        }

        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorMessage]
  );

  const { control, sendUserMessage } = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: {
        enabled: true,
      },
    },
    threadItemActions: {
      feedback: false,
    },
    onClientTool: async (invocation: {
      name: string;
      params: Record<string, unknown>;
    }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          if (isDev) {
            console.debug("[ChatKitPanel] switch_theme", requested);
          }
          onThemeRequest(requested as ColorScheme);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");

        if (!id || processedFacts.current.has(id)) {
          return { success: true };
        }

        processedFacts.current.add(id);

        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });

        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: () => {
      onResponseEnd();
    },
    onResponseStart: () => {
      setErrorMessage(null);
    },
    onThreadChange: () => {
      processedFacts.current.clear();
      hasAutoStartedRef.current = false;
    },
    onError: ({ error }: { error: unknown }) => {
      // ChatKit UI shows user-facing errors; this is just for logging.
      console.error("ChatKit error", error);
    },
  });

  // Auto-start the first message when the chat is ready and autoStartText is set.
  useEffect(() => {
    if (!control || !sendUserMessage || !autoStartText) {
      return;
    }
    if (hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;

    (async () => {
      try {
        await sendUserMessage({
          text: autoStartText,
          newThread: true,
        });
      } catch (error) {
        console.error("Failed to send auto-start message", error);
        setErrorMessage(
          "Connected, but failed to send the initial message. You can type manually."
        );
      }
    })();
  }, [control, sendUserMessage, autoStartText, setErrorMessage]);

  const hasError = Boolean(errors.message);

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(control),
      hasError,
      workflowId: WORKFLOW_ID,
    });
  }

  return (
    <div className="relative flex h-[600px] flex-col">
      <ErrorOverlay
        error={errors.message}
        fallbackMessage={
          isInitializingSession ? "Initializing chat session..." : null
        }
        onRetry={hasError ? handleResetChat : null}
      />

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {control ? (
          <ChatKit key={widgetInstanceKey} control={control} className="h-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading chat…
          </div>
        )}
      </div>
    </div>
  );
}

type ErrorLikeWithMessage = {
  message?: unknown;
};

type ErrorDetailsWithError = {
  error?: unknown;
};

function isErrorLikeWithMessage(
  value: unknown
): value is ErrorLikeWithMessage & { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as ErrorLikeWithMessage).message === "string"
  );
}

function isErrorDetailsWithError(value: unknown): value is ErrorDetailsWithError {
  return typeof value === "object" && value !== null && "error" in value;
}

function extractErrorDetail(
  payload: CreateSessionResponse | undefined,
  fallback: string
): string {
  if (!payload) {
    return fallback;
  }

  const { error, details, message } = payload;

  if (typeof error === "string") {
    return error;
  }

  if (isErrorLikeWithMessage(error)) {
    return error.message;
  }

  if (typeof details === "string") {
    return details;
  }

  if (isErrorDetailsWithError(details)) {
    const nestedError = details.error;

    if (typeof nestedError === "string") {
      return nestedError;
    }

    if (isErrorLikeWithMessage(nestedError)) {
      return nestedError.message;
    }
  }

  if (typeof message === "string") {
    return message;
  }

  return fallback;
}
