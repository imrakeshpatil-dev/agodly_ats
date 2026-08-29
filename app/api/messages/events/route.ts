import { authenticateRequest } from "@/lib/server/http";
import { messagingEventsService } from "@/lib/server/services/messaging-events.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = authenticateRequest(request);
  if (!session) return Response.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe = (): void => undefined;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: string) => controller.enqueue(encoder.encode(value));
      write(`event: ready\ndata: ${JSON.stringify({ connected: true, userId: session.user.id })}\n\n`);
      unsubscribe = messagingEventsService.subscribe(session.user.id, (event) => {
        try {
          write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          unsubscribe();
        }
      });
      heartbeat = setInterval(() => {
        try {
          write(`: keepalive ${Date.now()}\n\n`);
        } catch {
          unsubscribe();
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 20_000);
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      }, { once: true });
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
