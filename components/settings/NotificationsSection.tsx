"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IconTile, ListRow, ListSection } from "@/components/ui/List";
import { Toggle } from "@/components/ui/Toggle";
import { formatDate, formatTime } from "@/lib/time";

type Reminder = { id: string; title: string; remindAt: string; userId: string; userName?: string };

/** Why this device can't turn notifications on, or null when it can. */
function unsupportedReason(): string | null {
  if (typeof window === "undefined") return null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "On iPhone and iPad, add NEWMUX OS to your Home Screen first (Safari → Share → Add to Home Screen), then open it from there and turn this on.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "This browser can't show notifications.";
  return null;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The service worker, or null if it isn't running (it's off in development). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} · ${browser}` : os;
}

/**
 * Settings → Notifications: push on this device, a test, and the reminders
 * still to come. What gets sent is decided on the server (lib/push/notify.ts).
 */
export function NotificationsSection() {
  const [reason, setReason] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const loadReminders = useCallback(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d: { reminders?: Reminder[] }) => setReminders(d.reminders ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setReason(unsupportedReason());
    fetch("/api/push")
      .then((r) => r.json())
      .then((d: { configured?: boolean; publicKey?: string | null }) => {
        setConfigured(!!d.configured);
        setPublicKey(d.publicKey ?? null);
      })
      .catch(() => setConfigured(false));
    if (!unsupportedReason()) {
      void registration().then(async (reg) => setEnabled(!!(await reg?.pushManager.getSubscription()) && Notification.permission === "granted"));
    }
    loadReminders();
  }, [loadReminders]);

  const turnOn = async () => {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error(permission === "denied" ? "Notifications are blocked for this app. Allow them in your device's settings, then try again." : "Notifications weren't allowed.");
      return;
    }
    const reg = await registration();
    if (!reg) {
      toast.error("The app's background helper isn't running. Reload the app and try again.");
      return;
    }
    const existing = await reg.pushManager.getSubscription();
    // A subscription made with another key (keys were changed on the server) has to be replaced.
    if (existing) await existing.unsubscribe();
    // The browser registers with its push service (Apple, Google, Mozilla); don't wait forever if it can't reach it.
    const sub = await Promise.race([
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000)),
    ]);
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...sub.toJSON(), device: deviceName() }) });
    if (!res.ok) {
      await sub.unsubscribe();
      throw new Error("save failed");
    }
    setEnabled(true);
    toast.success("Notifications are on for this device");
  };

  const turnOff = async () => {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setEnabled(false);
    toast.success("Notifications are off for this device");
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await (on ? turnOn() : turnOff());
    } catch {
      toast.error("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const res = await fetch("/api/push/test", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) toast.success("Sent. It should appear in a few seconds.");
    else toast.error(json.error ?? "Couldn't send a test.");
  };

  const cancel = async (r: Reminder) => {
    const res = await fetch(`/api/reminders/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setReminders((list) => list.filter((x) => x.id !== r.id));
      toast.success("Reminder cancelled");
    } else toast.error("Couldn't cancel it.");
  };

  const footer =
    configured === false
      ? "Notifications aren't set up on the server yet: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and CRON_SECRET need adding (see the deploy guide)."
      : reason ??
        "Reminders you or Haman set, CRM follow-ups when due, your tasks due today (9:00), meetings 15 minutes before, and for partners renewals and hosting fees a week ahead and on the day. Turn it on on each device you want them on.";

  return (
    <>
      <ListSection header="Notifications" footer={footer}>
        <ListRow
          leading={<IconTile icon={Bell} color="red" />}
          title="Notifications on this device"
          trailing={<Toggle label="Notifications on this device" checked={enabled} disabled={busy || !!reason || !configured} onChange={(v) => void toggle(v)} />}
        />
        {enabled && <ListRow leading={<IconTile icon={BellRing} color="orange" />} title="Send a Test" onClick={() => void test()} />}
      </ListSection>

      {reminders.length > 0 && (
        <ListSection header="Upcoming Reminders" footer="Ask Haman to set one: “remind me to call Ox on Thursday at 10”.">
          {reminders.map((r) => (
            <ListRow
              key={r.id}
              leading={<IconTile icon={Clock} color="indigo" />}
              title={r.title}
              subtitle={`${formatDate(r.remindAt, { weekday: "short", day: "numeric", month: "short" })} at ${formatTime(r.remindAt)}${r.userName ? ` · for ${r.userName}` : ""}`}
              trailing={
                <button type="button" aria-label={`Cancel ${r.title}`} className="p-2 text-label-3 hover:text-ios-red" onClick={() => void cancel(r)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              }
            />
          ))}
        </ListSection>
      )}
    </>
  );
}
