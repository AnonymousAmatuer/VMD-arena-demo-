"use client";
import { useEffect, useRef, useState } from "react";
import { freshProfile, validProfile, type Profile } from "./data";
export const PROFILE_KEY = "vmd.engineer.v1";
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(freshProfile),
    [ready, setReady] = useState(false),
    [saveState, setSaveState] = useState("Local save ready");
  const device = useRef(""),
    lastMatch = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    let local: Profile | null = null;
    try {
      device.current =
        localStorage.getItem("vmd.device") || crypto.randomUUID();
      localStorage.setItem("vmd.device", device.current);
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (validProfile(saved)) {
        local = saved;
        setProfile(saved);
      }
    } catch {}
    const controller = new AbortController(),
      limit = setTimeout(() => controller.abort(), 2500);
    (async () => {
      try {
        if (!device.current) return;
        const r = await fetch("/api/save", {
            headers: { "x-device-key": device.current },
            signal: controller.signal,
          }),
          d = await r.json();
        if (
          active &&
          validProfile(d.profile) &&
          (!local || d.profile.updated > local.updated)
        )
          setProfile(d.profile);
      } catch {
      } finally {
        clearTimeout(limit);
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      clearTimeout(limit);
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const state = { ...profile, updated: Date.now() };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state));
      setSaveState("Saved locally");
    } catch {
      setSaveState("Storage unavailable");
    }
    const resultChanged = profile.history[0]?.id !== lastMatch.current;
    lastMatch.current = profile.history[0]?.id;
    const controller = new AbortController(),
      timer = setTimeout(
        async () => {
          if (!device.current) return;
          try {
            const r = await fetch("/api/save", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-device-key": device.current,
              },
              body: JSON.stringify(state),
              signal: controller.signal,
            });
            if (r.ok) setSaveState("All changes saved");
          } catch {}
        },
        resultChanged ? 0 : 500,
      );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile, ready]);
  return {
    profile,
    setProfile,
    ready,
    saveState,
    reset: async () => {
      try {
        await fetch("/api/save", {
          method: "DELETE",
          headers: {
            "x-device-key": device.current,
            "x-confirm-reset": "reset",
          },
        });
      } catch {}
      setProfile(freshProfile());
    },
  };
}
