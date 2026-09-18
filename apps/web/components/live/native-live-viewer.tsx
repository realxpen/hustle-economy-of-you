"use client";

import { useEffect, useRef, useState } from "react";

import { getLiveViewerCredential } from "../../lib/live";
import {
  loadLiveKitBrowserSdk,
  type LiveKitRoom,
  type LiveKitTrack
} from "../../lib/livekit-browser";
import styles from "../../app/live/live.module.css";

type ViewerMediaState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED" | "ERROR";

export function NativeLiveViewer({ liveId }: { liveId: string }) {
  const mediaRootRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const [state, setState] = useState<ViewerMediaState>("CONNECTING");
  const [hasMedia, setHasMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    const clearMedia = () => {
      const root = mediaRootRef.current;
      if (root) root.replaceChildren();
      setHasMedia(false);
    };

    const join = async () => {
      if (cancelled) return;
      setError(null);
      setState("CONNECTING");

      try {
        const [credential, sdk] = await Promise.all([
          getLiveViewerCredential(liveId),
          loadLiveKitBrowserSdk()
        ]);
        if (cancelled) return;

        const room = new sdk.Room({
          adaptiveStream: true,
          dynacast: true
        });
        roomRef.current = room;

        const subscribed = (track: LiveKitTrack) => {
          if (cancelled) return;
          const root = mediaRootRef.current;
          if (!root) return;
          const element = track.attach();
          element.autoplay = true;
          if (element instanceof HTMLVideoElement) {
            element.playsInline = true;
            element.className = styles.remoteVideo;
          } else {
            element.className = styles.remoteAudio;
          }
          root.appendChild(element);
          setHasMedia(true);
        };

        const unsubscribed = (track: LiveKitTrack) => {
          for (const element of track.detach()) element.remove();
          const root = mediaRootRef.current;
          if (root && root.childElementCount === 0) setHasMedia(false);
        };

        const reconnecting = () => setState("RECONNECTING");
        const reconnected = () => setState("CONNECTED");
        const disconnected = () => {
          if (cancelled) return;
          roomRef.current = null;
          setState("DISCONNECTED");
          clearMedia();
          retryTimer = window.setTimeout(() => void join(), 2_000);
        };

        room
          .on(sdk.RoomEvent.TrackSubscribed, subscribed as (...args: any[]) => void)
          .on(sdk.RoomEvent.TrackUnsubscribed, unsubscribed as (...args: any[]) => void)
          .on(sdk.RoomEvent.Reconnecting, reconnecting)
          .on(sdk.RoomEvent.Reconnected, reconnected)
          .on(sdk.RoomEvent.Disconnected, disconnected);

        await room.connect(credential.serverUrl, credential.participantToken);
        if (cancelled) {
          await room.disconnect(true);
          return;
        }
        setState("CONNECTED");
      } catch (reason) {
        if (cancelled) return;
        setState("ERROR");
        setError(reason instanceof Error ? reason.message : "Could not connect to Live media");
        retryTimer = window.setTimeout(() => void join(), 3_000);
      }
    };

    void join();

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.disconnect(true);
      clearMedia();
    };
  }, [liveId]);

  async function enableSound() {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setSoundEnabled(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your browser blocked Live audio");
    }
  }

  return <div className={styles.nativeStage}>
    <div ref={mediaRootRef} className={styles.remoteMediaRoot} />
    {!hasMedia && <div className={styles.stagePlaceholder}>
      <div className={styles.eyebrow}>NATIVE LIVE · {state}</div>
      <h2>{state === "ERROR" ? "Reconnecting to the broadcast…" : "Waiting for the host media…"}</h2>
      <p>{error ?? "The room is live. Video and audio will appear here as soon as the host publisher is available."}</p>
    </div>}
    {state === "CONNECTED" && !soundEnabled &&
      <button className={styles.soundButton} type="button" onClick={() => void enableSound()}>
        Enable sound
      </button>}
  </div>;
}
