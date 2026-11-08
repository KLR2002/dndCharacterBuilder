import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";
import { Button } from "./Button";

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightPercent?: number;
  /** True when closing now would throw away input the player has not saved; the shell then asks before closing. */
  hasUnsavedChanges?: boolean;
}

export const Modal: React.FC<CustomModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightPercent = 85,
  hasUnsavedChanges = false,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);

  // A closed modal never keeps its question open. Adjusting state while rendering (not in an effect)
  // keeps this to one render when `visible` turns false.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setAsking(false);
  }

  // Every close path (backdrop, ✕, Android Back, Escape) goes through here: an unsaved-change modal
  // asks first, and while it asks any further close request just dismisses the question.
  const requestClose = useCallback(() => {
    if (asking) {
      setAsking(false);
      return;
    }
    if (hasUnsavedChanges) {
      setAsking(true);
      return;
    }
    onClose();
  }, [asking, hasUnsavedChanges, onClose]);

  // Escape closes the open modal on the web. The listener captures: a focused TextInput stops
  // keydown propagation, so a bubble-phase listener on document would never see Escape. It reads
  // the latest close logic through a ref, so it subscribes only when `visible` changes.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [visible]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      // On the web, RN Modal fires onRequestClose on Escape keyup as well, which would run the
      // close path twice per key press with the keydown listener above. So the web Escape path is
      // that listener alone; onRequestClose stays for the native Android Back button.
      onRequestClose={Platform.OS === "web" ? undefined : requestClose}>
      <View style={[styles.overlay, { paddingBottom: Math.max(16, insets.bottom + 16) }]}>
        <Pressable style={styles.backdrop} onPress={requestClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.container,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              maxHeight: `${maxHeightPercent}%`,
            },
          ]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={requestClose}
              style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: "bold" }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {/* Footer */}
          {footer ? (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>

        {asking ? (
          <View style={styles.confirmOverlay}>
            <Pressable style={styles.backdrop} onPress={requestClose} />
            <View
              style={[
                styles.confirmCard,
                { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
              ]}>
              <Text style={[styles.confirmTitle, { color: theme.text }]}>Discard changes?</Text>
              <View style={styles.confirmRow}>
                <Button title="Keep editing" variant="ghost" onPress={requestClose} />
                <Button
                  title="Discard"
                  variant="danger"
                  onPress={() => {
                    setAsking(false);
                    onClose();
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    padding: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  confirmRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
});
