"use client";

export const LIVEKIT_BROWSER_SDK_VERSION = "2.22.3";
const LIVEKIT_CDN_SRC = `https://cdn.jsdelivr.net/npm/livekit-client@${LIVEKIT_BROWSER_SDK_VERSION}/dist/livekit-client.umd.min.js`;

export interface LiveKitTrack {
  kind: string;
  attach(element?: HTMLMediaElement): HTMLMediaElement;
  detach(): HTMLMediaElement[];
}

export interface LiveKitTrackPublication {
  track?: LiveKitTrack | null;
}

export interface LiveKitLocalParticipant {
  setCameraEnabled(enabled: boolean, options?: unknown, publishOptions?: unknown): Promise<LiveKitTrackPublication | undefined>;
  setMicrophoneEnabled(enabled: boolean, options?: unknown, publishOptions?: unknown): Promise<LiveKitTrackPublication | undefined>;
}

export interface LiveKitRoom {
  localParticipant: LiveKitLocalParticipant;
  canPlaybackAudio: boolean;
  connect(url: string, token: string): Promise<void>;
  disconnect(stopTracks?: boolean): Promise<void>;
  startAudio(): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): LiveKitRoom;
  off(event: string, listener: (...args: any[]) => void): LiveKitRoom;
}

export interface LiveKitBrowserSdk {
  Room: new (options?: Record<string, unknown>) => LiveKitRoom;
  RoomEvent: {
    TrackSubscribed: string;
    TrackUnsubscribed: string;
    Reconnecting: string;
    Reconnected: string;
    Disconnected: string;
    AudioPlaybackStatusChanged: string;
  };
  Track: {
    Kind: { Video: string; Audio: string };
  };
  VideoPresets: {
    h720: { resolution: unknown };
  };
}

declare global {
  interface Window {
    LivekitClient?: LiveKitBrowserSdk;
  }
}

let sdkPromise: Promise<LiveKitBrowserSdk> | null = null;

export function loadLiveKitBrowserSdk(): Promise<LiveKitBrowserSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Native Live media is only available in the browser"));
  }
  if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<LiveKitBrowserSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hustle-livekit="true"]');
    const script = existing ?? document.createElement("script");

    const finish = () => {
      if (window.LivekitClient) resolve(window.LivekitClient);
      else reject(new Error("Live media SDK loaded without exposing its browser client"));
    };
    const fail = () => reject(new Error("Could not load the native Live media SDK"));

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.src = LIVEKIT_CDN_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.hustleLivekit = "true";
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

export function describeMediaDeviceError(reason: unknown) {
  if (!(reason instanceof DOMException)) {
    return reason instanceof Error ? reason.message : "Could not start camera and microphone";
  }
  if (reason.name === "NotAllowedError" || reason.name === "SecurityError") {
    return "Camera or microphone permission was denied. Allow access in your browser and try again.";
  }
  if (reason.name === "NotFoundError" || reason.name === "DevicesNotFoundError") {
    return "No usable camera or microphone was found on this device.";
  }
  if (reason.name === "NotReadableError" || reason.name === "TrackStartError") {
    return "Your camera or microphone is busy in another app or browser tab.";
  }
  return reason.message || "Could not start camera and microphone";
}
