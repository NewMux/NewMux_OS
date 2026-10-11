/**
 * Push notifications in the service worker. next-pwa bundles this file into
 * public/sw.js (see next.config.ts). The server sends { title, body, url, tag }
 * (lib/push/webpush.ts); tapping the notification opens `url` in the app,
 * reusing an open window when there is one.
 */

type Payload = { title?: string; body?: string; url?: string; tag?: string };

type WindowClientLike = { url: string; focus(): Promise<unknown>; navigate(url: string): Promise<unknown> };
type Scope = {
  location: { origin: string };
  registration: { showNotification(title: string, options: Record<string, unknown>): Promise<void> };
  clients: { matchAll(o: { type: "window"; includeUncontrolled: boolean }): Promise<WindowClientLike[]>; openWindow(url: string): Promise<unknown> };
  addEventListener(type: "push", fn: (e: { data: { json(): unknown; text(): string } | null; waitUntil(p: Promise<unknown>): void }) => void): void;
  addEventListener(type: "notificationclick", fn: (e: { notification: { data?: { url?: string }; close(): void }; waitUntil(p: Promise<unknown>): void }) => void): void;
};

const sw = self as unknown as Scope;

sw.addEventListener("push", (event) => {
  let payload: Payload = {};
  try {
    payload = (event.data?.json() as Payload) ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  event.waitUntil(
    sw.registration.showNotification(payload.title || "NEWMUX OS", {
      body: payload.body ?? "",
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/home" },
    }),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only paths inside the app; anything else opens Today.
  const path = event.notification.data?.url ?? "/home";
  const target = new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/home", sw.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === sw.location.origin);
      if (open) {
        await open.navigate(target).catch(() => undefined);
        await open.focus();
      } else {
        await sw.clients.openWindow(target);
      }
    })(),
  );
});

export {};
