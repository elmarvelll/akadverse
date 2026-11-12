"use client";

// The video area of a live class, shared by lecturer and students. Fetches a LiveKit join token (whose grant decides
// whether this person can publish) and renders whatever the lecturer is publishing: their screen share large with the
// camera as a small inset, or just the camera. The lecturer additionally gets the mic/camera/share controls.

import { useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, ControlBar, useTracks, useLocalParticipant, useRemoteParticipants, useIsSpeaking, useConnectionState, isTrackReference, type TrackReference } from "@livekit/components-react";
import { ConnectionState, DisconnectReason, Track, type Participant } from "livekit-client";
import { Loader2, Maximize, Minimize, MicOff, MonitorUp, VideoOff } from "lucide-react";
import "@livekit/components-styles";
import { configureLiveKitLogging } from "./livekit-logging";

configureLiveKitLogging();

export default function LiveStage({
  sessionId,
  isTeacher,
  onEnded,
  controls,
  children,
}: {
  sessionId: string;
  isTeacher: boolean;
  // Called if LiveKit drops us for good (e.g. the lecturer ended the class and the room was closed).
  onEnded?: () => void;
  // Extra buttons for the bottom bar beside mic/camera/share (the lecturer's End class). Inside the card, so they
  // stay available in full screen.
  controls?: React.ReactNode;
  // Overlays drawn over the video (the student's poll pop-up).
  children?: React.ReactNode;
}) {
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  // Connect one tick after the room mounts, not on mount. In dev, React Strict Mode mounts every new component twice;
  // connecting on mount opened two connections with the same identity, and LiveKit (one connection per identity)
  // kicked one mid-join: "Received leave request while trying to (re)connect". This effect runs on the `conn` UPDATE,
  // which Strict Mode doesn't double, so exactly one connection is made.
  const [connectNow, setConnectNow] = useState(false);
  useEffect(() => {
    if (!conn) return;
    const t = setTimeout(() => setConnectNow(true), 0);
    return () => clearTimeout(t);
  }, [conn]);

  useEffect(() => {
    // Also catches leaving full screen with Esc, which never goes through our button.
    const onChange = () => setIsFull(document.fullscreenElement !== null && document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else cardRef.current?.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/e-learning/classroom/${sessionId}/token`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't join the class.");
        if (!cancelled) setConn(data);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't join the class."));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-w-0 flex-1"><Frame>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-100">
          <VideoOff size={28} aria-hidden />
          {error}
        </div>
      </Frame></div>
    );
  }
  if (!conn) {
    return (
      <div className="min-w-0 flex-1"><Frame>
        <div className="absolute inset-0 flex items-center justify-center text-gray-300"><Loader2 className="animate-spin" size={28} aria-label="Connecting" /></div>
      </Frame></div>
    );
  }

  return (
    // Full screen takes this whole card (video, control bar, overlays such as the poll pop-up), not just the video.
    <div
      ref={cardRef}
      className={isFull ? "flex h-full w-full flex-col bg-[#111]" : "min-w-0 flex-1 overflow-hidden rounded-2xl"}
    >
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect={connectNow}
        audio={isTeacher}
        video={isTeacher}
        onDisconnected={(reason) => {
          // Same account opened the class again elsewhere: LiveKit keeps the newest connection and drops this one.
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            setError("You joined this class in another tab or window, so it was closed here. Reload this page to watch here instead.");
            return;
          }
          onEnded?.();
        }}
        onMediaDeviceFailure={() => setMediaError(true)}
        data-lk-theme="default"
        className={`flex flex-col gap-2 ${isFull ? "h-full" : ""}`}
      >
        <Frame full={isFull} onToggleFullscreen={toggleFullscreen}>
          <Stage isTeacher={isTeacher} />
          <ReconnectingNotice />
          {children}
        </Frame>
        <RoomAudioRenderer />
        {mediaError && isTeacher && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Couldn&apos;t access your camera or microphone. Allow access in your browser&apos;s address bar, then use the controls below to turn them on.
          </p>
        )}
        {isTeacher && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 border-t border-white/10 px-3">
            <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: false, settings: false }} className="border-t-0!" />
            {controls}
          </div>
        )}
      </LiveKitRoom>
    </div>
  );
}

// The video box. Normally 16:9 and capped in height so the side panels stay in view; in full screen it grows to fill
// whatever the control bar leaves. The corner button (when given a handler) toggles full screen.
function Frame({ children, full = false, onToggleFullscreen }: { children: React.ReactNode; full?: boolean; onToggleFullscreen?: () => void }) {
  return (
    <div
      className={
        full
          ? "relative min-h-0 w-full flex-1 overflow-hidden bg-gray-900"
          : "relative mx-auto aspect-video w-full max-h-[70vh] min-w-0 overflow-hidden rounded-2xl bg-gray-900"
      }
      style={full ? undefined : { maxWidth: "calc(70vh * 16 / 9)" }}
    >
      {children}
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={full ? "Exit full screen" : "Full screen"}
          title={full ? "Exit full screen" : "Full screen"}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
        >
          {full ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
        </button>
      )}
    </div>
  );
}

function Stage({ isTeacher }: { isTeacher: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
    .filter(isTrackReference)
    // A camera (or mic) switched off stays published but muted, and a muted camera renders as a black box: treat it as absent.
    .filter((t) => !t.publication.isMuted);

  // The lecturer is the only one whose token can publish (students are watch-only), so that's how we find them.
  const host: Participant | undefined = isTeacher ? localParticipant : remotes.find((p) => p.permissions?.canPublish);
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const camera = tracks.find((t) => t.source === Track.Source.Camera);
  const isMine = (t: TrackReference) => t.participant.identity === localParticipant.identity;
  const cameraLabel = camera ? (isMine(camera) ? "You" : camera.participant.name || "Lecturer") : "";

  if (!screen && !camera) {
    // Like Meet: once the lecturer is in the class they're on stage, camera or not, so students can see who's
    // talking even when it's audio only. Only before they've joined is there nothing to show.
    if (!host) {
      return <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-300">Waiting for the lecturer to join…</div>;
    }
    const micOn = tracks.some((t) => t.source === Track.Source.Microphone && t.participant.identity === host.identity);
    return <AvatarTile participant={host} label={isTeacher ? "You" : host.name || "Lecturer"} micOn={micOn} />;
  }

  // No screen share: the camera is the whole stage (Meet's normal tile).
  if (!screen) {
    return (
      <>
        <VideoTrack trackRef={camera!} className={`absolute inset-0 h-full w-full object-contain ${isMine(camera!) ? "-scale-x-100" : ""}`} />
        <NameLabel className="bottom-3 left-3">{cameraLabel}</NameLabel>
      </>
    );
  }

  return (
    <>
      {isMine(screen) ? (
        // Like Meet, the presenter never sees their own share: sharing the whole screen (or this tab) would capture
        // the preview itself and collapse into a black hall of mirrors. Students still receive the real stream.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-gray-100">
          <MonitorUp size={32} aria-hidden />
          <p className="text-base font-semibold">You&apos;re presenting to everyone</p>
          <button
            type="button"
            onClick={() => localParticipant.setScreenShareEnabled(false).catch(() => {})}
            className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-white"
          >
            Stop presenting
          </button>
        </div>
      ) : (
        <>
          {/* Pinned to the frame (not h-full): otherwise a large stream can fall back to its native size and overflow. */}
          <VideoTrack trackRef={screen} className="absolute inset-0 h-full w-full object-contain" />
          <NameLabel className="left-3 top-3">{screen.participant.name || "Lecturer"} is presenting</NameLabel>
        </>
      )}
      {camera && <FloatingCamera trackRef={camera} label={cameraLabel} mirror={isMine(camera)} />}
    </>
  );
}

// LiveKit reconnects by itself when the network blips; say so instead of leaving a frozen picture unexplained.
// The lecturer with no video: initials in a circle that rings while they speak (Meet's camera-off tile).
function AvatarTile({ participant, label, micOn }: { participant: Participant; label: string; micOn: boolean }) {
  const speaking = useIsSpeaking(participant);
  const name = participant.name || "Lecturer";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "L";
  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          aria-hidden
          className={`flex aspect-square w-[22%] max-w-40 min-w-16 items-center justify-center rounded-full bg-blue-700 text-[clamp(1.25rem,4vw,3rem)] font-semibold text-white transition-shadow duration-150 ${
            speaking ? "ring-4 ring-green-400 ring-offset-4 ring-offset-gray-900" : ""
          }`}
        >
          {initials}
        </div>
      </div>
      <NameLabel className="bottom-3 left-3 flex items-center gap-1.5">
        {!micOn && <MicOff size={12} aria-label="Microphone off" />}
        {label}
      </NameLabel>
    </>
  );
}

function ReconnectingNotice() {
  const state = useConnectionState();
  if (state !== ConnectionState.Reconnecting && state !== ConnectionState.SignalReconnecting) return null;
  return (
    <div role="status" className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-lg">
      <Loader2 size={14} className="animate-spin" aria-hidden /> Connection weak, reconnecting…
    </div>
  );
}

function NameLabel({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`pointer-events-none absolute z-10 max-w-[60%] truncate rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white ${className}`}>{children}</span>;
}

type Corner = "tl" | "tr" | "bl" | "br";
// Top corners sit lower so the card never covers the presenter label (top-left) or the full screen button (top-right).
const CORNER_CLASS: Record<Corner, string> = { tl: "left-3 top-14", tr: "right-3 top-14", bl: "left-3 bottom-3", br: "right-3 bottom-3" };
const CORNER_KEY = "classroom-camera-corner";

function readCorner(): Corner {
  try {
    const v = localStorage.getItem(CORNER_KEY);
    return v === "tl" || v === "tr" || v === "bl" || v === "br" ? v : "br";
  } catch {
    return "br";
  }
}

// The camera while a screen is being shared: a small floating card, like Meet's. Drag it anywhere and it snaps to the
// nearest corner on release; arrow keys move it between corners too. The chosen corner is this viewer's own preference
// (remembered on this device), so a student moving the lecturer's card changes nothing for anyone else.
function FloatingCamera({ trackRef, label, mirror }: { trackRef: TrackReference; label: string; mirror: boolean }) {
  const [corner, setCorner] = useState<Corner>(readCorner);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const settle = (c: Corner) => {
    setCorner(c);
    try {
      localStorage.setItem(CORNER_KEY, c);
    } catch {}
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = e.currentTarget.getBoundingClientRect();
    grab.current = { dx: e.clientX - card.left, dy: e.clientY - card.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!grab.current) return;
    const parent = e.currentTarget.parentElement!.getBoundingClientRect();
    const card = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - parent.left - grab.current.dx, 0), parent.width - card.width);
    const y = Math.min(Math.max(e.clientY - parent.top - grab.current.dy, 0), parent.height - card.height);
    setDrag({ x, y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!grab.current) return;
    grab.current = null;
    if (drag) {
      const parent = e.currentTarget.parentElement!.getBoundingClientRect();
      const card = e.currentTarget.getBoundingClientRect();
      const top = drag.y + card.height / 2 < parent.height / 2;
      const left = drag.x + card.width / 2 < parent.width / 2;
      settle(`${top ? "t" : "b"}${left ? "l" : "r"}` as Corner);
    }
    setDrag(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const [v, h] = corner.split("") as ["t" | "b", "l" | "r"];
    const next = { ArrowUp: `t${h}`, ArrowDown: `b${h}`, ArrowLeft: `${v}l`, ArrowRight: `${v}r` }[e.key] as Corner | undefined;
    if (next) {
      e.preventDefault();
      settle(next);
    }
  };

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${label} camera. Drag, or use the arrow keys, to move it to another corner.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      style={drag ? { left: drag.x, top: drag.y } : undefined}
      className={`absolute z-10 aspect-video w-1/5 min-w-36 max-w-72 touch-none select-none overflow-hidden rounded-xl bg-gray-800 shadow-2xl ring-1 ring-white/20 focus-visible:outline-2 focus-visible:outline-white ${
        drag ? "cursor-grabbing" : `cursor-grab ${CORNER_CLASS[corner]}`
      }`}
    >
      <VideoTrack trackRef={trackRef} className={`pointer-events-none h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`} />
      <NameLabel className="bottom-1.5 left-1.5">{label}</NameLabel>
    </div>
  );
}
