"use client";

import { useEffect, useRef, useState } from "react";

import {
  getLivePublishCredential,
  recordLiveMediaPresence,
  type LiveSessionStatus
} from "../../lib/live";
import {
  describeMediaDeviceError,
  loadLiveKitBrowserSdk,
  type LiveKitRoom,
  type LiveKitTrackPublication
} from "../../lib/livekit-browser";
import styles from "../../app/live/live.module.css";

type MediaState = "IDLE" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED" | "ERROR";

export function NativeLiveBroadcaster({
  liveId,
  status,
  available,
  onConnectionChange
}: {
  liveId: string;
  status: LiveSessionStatus;
  available: boolean;
  onConnectionChange?: (connected: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const [mediaState, setMediaState] = useState<MediaState>("IDLE");
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stopHeartbeat() {
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    void recordLiveMediaPresence(liveId, true).catch(() => undefined);
    heartbeatRef.current = window.setInterval(() => {
      void recordLiveMediaPresence(liveId, true).catch(() => undefined);
    }, 15_000);
  }

  async function disconnect(reportPresence = true) {
    stopHeartbeat();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      await room.disconnect(true).catch(() => undefined);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setMicrophoneOn(false);
    setMediaState("DISCONNECTED");
    onConnectionChange?.(false);
    if (reportPresence) {
      void recordLiveMediaPresence(liveId, false).catch(() => undefined);
    }
  }

  async function connect() {
    if (!available || status === "ENDED" || status === "CANCELLED") return;
    setError(null);
    setMediaState("CONNECTING");

    try {
      const credential = await getLivePublishCredential(liveId);
      const sdk = await loadLiveKitBrowserSdk();
      const room = new sdk.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: sdk.VideoPresets.h720.resolution
        }
      });

      const reconnecting = () => {
        setMediaState("RECONNECTING");
        onConnectionChange?.(false);
      };
      const reconnected = () => {
        setMediaState("CONNECTED");
        onConnectionChange?.(true);
        startHeartbeat();
      };
      const disconnected = () => {
        stopHeartbeat();
        roomRef.current = null;
        setMediaState("DISCONNECTED");
        setCameraOn(false);
        setMicrophoneOn(false);
        onConnectionChange?.(false);
        void recordLiveMediaPresence(liveId, false).catch(() => undefined);
      };

      room
        .on(sdk.RoomEvent.Reconnecting, reconnecting)
        .on(sdk.RoomEvent.Reconnected, reconnected)
        .on(sdk.RoomEvent.Disconnected, disconnected);

      await room.connect(credential.serverUrl, credential.participantToken);
      roomRef.current = room;

      const cameraPublication = await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      attachCamera(cameraPublication);

      setCameraOn(true);
      setMicrophoneOn(true);
      setMediaState("CONNECTED");
      onConnectionChange?.(true);
      startHeartbeat();
    } catch (reason) {
      await disconnect(false);
      setMediaState("ERROR");
      setError(describeMediaDeviceError(reason));
    }
  }

  function attachCamera(publication?: LiveKitTrackPublication) {
    const element = videoRef.current;
    const track = publication?.track;
    if (!element || !track) return;
    track.attach(element);
    element.muted = true;
    element.autoplay = true;
    element.playsInline = true;
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !cameraOn;
      const publication = await room.localParticipant.setCameraEnabled(next);
      if (next) attachCamera(publication);
      setCameraOn(next);
    } catch (reason) {
      setError(describeMediaDeviceError(reason));
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !microphoneOn;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneOn(next);
    } catch (reason) {
      setError(describeMediaDeviceError(reason));
    }
  }

  useEffect(() => {
    if (status === "ENDED" || status === "CANCELLED") {
      void disconnect();
    }
  }, [status]);

  useEffect(() => {
    return () => {
      stopHeartbeat();
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.disconnect(true);
      void recordLiveMediaPresence(liveId, false).catch(() => undefined);
    };
  }, [liveId]);

  if (!available) {
    return <section className={styles.mediaPanel}>
      <div className={styles.eyebrow}>NATIVE MEDIA</div>
      <h3>Native broadcasting is not configured on this API.</h3>
      <p className={styles.muted}>Configure the Live media transport or keep using a legitimate external playback source.</p>
    </section>;
  }

  const connected = mediaState === "CONNECTED" || mediaState === "RECONNECTING";

  return <section className={styles.mediaPanel}>
    <div className={styles.mediaHeader}>
      <div>
        <div className={styles.eyebrow}>NATIVE CAMERA + MICROPHONE</div>
        <h3>{connected ? "Broadcast transport connected" : "Connect your broadcast"}</h3>
      </div>
      <span className={styles.pill}>{mediaState}</span>
    </div>

    <div className={styles.localPreview}>
      <video ref={videoRef} muted autoPlay playsInline />
      {!connected && <div className={styles.previewOverlay}>
        <strong>Camera preview</strong>
        <span>Your media stays private from viewers until the Live session is started.</span>
      </div>}
    </div>

    {error && <div className={styles.error}>{error}</div>}

    <div className={styles.actions} style={{ marginTop: 14 }}>
      {!connected && status !== "ENDED" && status !== "CANCELLED" &&
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => void connect()} disabled={mediaState === "CONNECTING"}>
          {mediaState === "CONNECTING" ? "Connecting…" : "Connect camera + mic"}
        </button>}
      {connected && <>
        <button className={styles.button} type="button" onClick={() => void toggleCamera()}>
          Camera {cameraOn ? "on" : "off"}
        </button>
        <button className={styles.button} type="button" onClick={() => void toggleMicrophone()}>
          Mic {microphoneOn ? "on" : "off"}
        </button>
        <button className={styles.button} type="button" onClick={() => void disconnect()}>
          Disconnect media
        </button>
      </>}
    </div>
  </section>;
}
