// src/app/api/marketplace/notifications/stream/route.ts
//
// GET -> one Server-Sent-Events connection for the signed-in user. This is
// the ONLY SSE endpoint in the app — src/app/studashboard/marketplace/_components/NotificationProvider.tsx
// opens exactly one EventSource to it per session and shares the result
// with every marketplace component (bell, dropdown, etc) via context.
//
// Delivery is two-layered: the in-process broadcaster
// (services/marketplace/notifications/sse-broadcaster.ts) pushes
// immediately when a notification is created on THIS server instance; a
// short interval poll (every 5s) inside this same connection also checks
// the DB directly, so a notification created by a request handled on a
// different instance still arrives within a few seconds. The database
// stays the single source of truth either way (see
// services/marketplace/notifications/notification.service.ts) — SSE only
// ever communicates that something changed.
//
// Idempotency: both paths funnel through the same send() below, which is
// the single gate that decides whether a notification actually goes out
// over the wire. It's keyed on Notification.id — not on the poll's
// createdAt cursor alone, since two notifications can share a timestamp —
// so if the broadcaster already delivered id X the instant it was
// created, the poll finding that same row moments later is a no-op, and
// vice versa. sentIds is capped so a long-lived connection doesn't grow
// this set forever.
//
// Node runtime (not edge): needs Prisma and the session helper, neither of
// which run on the edge runtime.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribe } from "@/services/marketplace/notifications/sse-broadcaster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 20000;
// Comfortably more than any realistic burst between polls — this is a
// dedup window, not a hard cap on throughput.
const MAX_TRACKED_IDS = 500;

interface NotificationPayload {
  id: string;
  scope: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  orderId: string | null;
  businessId: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Not signed in.", { status: 401 });
  }
  const userId = session.user.id;

  const encoder = new TextEncoder();
  let closed = false;
  let lastSeenAt = new Date();
  // Insertion-ordered, so trimming the oldest entries when over
  // MAX_TRACKED_IDS is a simple "delete the first N keys".
  const sentIds = new Set<string>();

  const stream = new ReadableStream({
    start(controller) {
      // The one place either delivery path actually writes to the wire —
      // both go through this, which is what makes the id-based dedup
      // below effective regardless of which path a given notification
      // arrives through first.
      const send = (event: string, data: unknown) => {
        if (closed) return;

        if (event === "notification") {
          const notification = data as NotificationPayload;
          if (sentIds.has(notification.id)) return;
          sentIds.add(notification.id);
          if (sentIds.size > MAX_TRACKED_IDS) {
            const oldest = sentIds.values().next().value;
            if (oldest !== undefined) sentIds.delete(oldest);
          }
          const createdAt = new Date(notification.createdAt);
          if (createdAt > lastSeenAt) lastSeenAt = createdAt;
        }

        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const unsubscribe = subscribe(userId, { send });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_INTERVAL_MS);

      // Fallback path — see file header. Catches notifications created on
      // a different server instance than this connection is held open on.
      // Rows already delivered by the broadcaster are filtered out by
      // send()'s sentIds check above, not here — the createdAt cursor is
      // just a query-size optimization (don't re-fetch old rows forever),
      // not the correctness guarantee.
      const poll = setInterval(async () => {
        if (closed) return;
        const rows = await prisma.notification.findMany({
          where: { userId, createdAt: { gt: lastSeenAt } },
          orderBy: { createdAt: "asc" },
        });
        for (const row of rows) {
          send("notification", {
            id: row.id,
            scope: row.scope,
            type: row.type,
            title: row.title,
            message: row.message,
            read: row.read,
            link: row.link,
            orderId: row.orderId,
            businessId: row.businessId,
            createdAt: row.createdAt.toISOString(),
          });
        }
      }, POLL_INTERVAL_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(poll);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting — nothing to do.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
