"use client";

// Downloads one Office document and parses it in the browser, for the PowerPoint / Word viewers. The parsed result
// owns blob: URLs for its images; they are revoked when the viewer unmounts (switching week/document) or retries.

import { useEffect, useState } from "react";
import { fetchDocumentBytes, GENERIC_ERROR } from "./document-access";

export const UNREADABLE = "This file couldn't be opened in Study Zone. Download it to read it.";

type State<T> = { status: "loading" } | { status: "ready"; doc: T } | { status: "error"; message: string };

// `read` must be a stable (module-level) function.
export function useOfficeDocument<T extends { objectUrls: string[] }>(id: string, read: (buffer: ArrayBuffer) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let made: T | null = null;
    fetchDocumentBytes(id)
      .then((buffer) => read(buffer).catch(() => { throw new Error(UNREADABLE); }))
      .then(
        (doc) => {
          made = doc;
          if (cancelled) doc.objectUrls.forEach((u) => URL.revokeObjectURL(u));
          else setState({ status: "ready", doc });
        },
        (e: unknown) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : GENERIC_ERROR }),
      );
    return () => {
      cancelled = true;
      made?.objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id, attempt, read]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  };
  return [state, retry] as const;
}
