import { useEffect, useState } from "react";
import { BackHandler, Keyboard, Platform } from "react-native";
import type { RootTab } from "./types";

type Options = {
  activeTab: RootTab;
  sheetOpen: boolean;
  onNavigateHome: () => void;
};

/**
 * Root-tab Android Back policy only. React Native Modal owns Back while open
 * via its onRequestClose callback; don't register duplicate modal handlers.
 * No navigation dependency, network call, session change, or data persistence.
 */
export function useDemoAndroidBack({ activeTab, sheetOpen, onNavigateHome }: Options) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const opened = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const closed = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { opened.remove(); closed.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // Android Modal has its own onRequestClose; it should dismiss the keyboard
      // first, then the sheet on a subsequent Back press.
      if (sheetOpen) return false;
      if (Keyboard.isVisible() || keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      if (activeTab !== "Home") {
        onNavigateHome();
        return true;
      }
      // Let Android handle Home-root exit/backgrounding normally.
      return false;
    });
    return () => subscription.remove();
  }, [activeTab, sheetOpen, keyboardVisible, onNavigateHome]);

  return { keyboardVisible };
}
