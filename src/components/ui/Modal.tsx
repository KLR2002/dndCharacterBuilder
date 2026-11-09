import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Modal as RNModal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  PanResponderGestureState,
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
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
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

/** How far (dp) a downward drag on a phone sheet must travel to close it on release. */
const SWIPE_CLOSE_DISTANCE = 80;
/** A phone sheet never covers more than this share of the screen, so a strip of background stays visible above it. */
const SHEET_MAX_HEIGHT_PERCENT = 90;

// The open web modals, in the order they opened: the last entry is the topmost modal. Only the topmost
// answers Escape, so one key press closes one modal even when several are stacked.
const openWebModals: symbol[] = [];

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
  const { isPhone } = useResponsiveLayout();
  const [asking, setAsking] = useState(false);

  // The phone sheet follows a downward drag with its own offset and closes on release. The body's scroll
  // offset decides whether a drag may claim the gesture: content that can still scroll up keeps scrolling,
  // so only a drag starting at the top of the content (or on the handle) drags the sheet.
  const [bodyAtTop, setBodyAtTop] = useState(true);
  const [dragY] = useState(() => new Animated.Value(0));

  // A closed modal never keeps its question open, and a reopened sheet starts at the top of its content,
  // so a sheet that was scrolled can still be swiped closed. Adjusting state while rendering (not in an
  // effect) keeps this to one render when `visible` changes.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setAsking(false);
    if (visible) setBodyAtTop(true);
  }

  // Every close path (backdrop, ✕, handle, swipe down, Android Back, Escape) goes through here: an
  // unsaved-change modal asks first, and while it asks any further close request just dismisses the question.
  // A swipe that closes fires the sheet's release handler and, on the web, the handle's press as well, so a
  // close request within this window after a swipe is the same gesture, not a new request.
  const [swipeCloseAt, setSwipeCloseAt] = useState(0);
  const requestClose = useCallback(() => {
    if (Date.now() - swipeCloseAt < 500) return;
    if (asking) {
      setAsking(false);
      return;
    }
    if (hasUnsavedChanges) {
      setAsking(true);
      return;
    }
    onClose();
  }, [asking, hasUnsavedChanges, onClose, swipeCloseAt]);

  // Escape closes the open modal on the web. The listener captures: a focused TextInput stops
  // keydown propagation, so a bubble-phase listener on document would never see Escape. It reads
  // the latest close logic through a ref, so it subscribes only when `visible` changes. Only the
  // topmost open modal handles the key, so with stacked modals one Escape closes just the top one.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  // A stable identity for this modal in the open-web-modals stack below.
  const [modalId] = useState(() => Symbol("modal"));
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    openWebModals.push(modalId);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openWebModals[openWebModals.length - 1] === modalId) requestCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const at = openWebModals.indexOf(modalId);
      if (at >= 0) openWebModals.splice(at, 1);
    };
  }, [visible, modalId]);

  const onBodyScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const atTop = event.nativeEvent.contentOffset.y <= 0;
    setBodyAtTop((prev) => (prev === atTop ? prev : atTop));
  }, []);

  const moveShouldSetCapture = useCallback(
    (_e: GestureResponderEvent, gestureState: PanResponderGestureState) =>
      isPhone &&
      gestureState.dy > 8 &&
      Math.abs(gestureState.dx) < gestureState.dy &&
      bodyAtTop,
    [isPhone, bodyAtTop],
  );
  const onDragMove = useCallback(
    (_e: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      dragY.setValue(Math.max(0, gestureState.dy));
    },
    [dragY],
  );
  const onDragRelease = useCallback(
    (_e: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const shouldClose =
        gestureState.dy > SWIPE_CLOSE_DISTANCE || (gestureState.dy > 24 && gestureState.vy > 0.5);
      Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start();
      if (shouldClose) {
        setSwipeCloseAt(Date.now());
        requestClose();
      }
    },
    [dragY, requestClose, setSwipeCloseAt],
  );
  const onDragTerminate = useCallback(() => {
    Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start();
  }, [dragY]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: moveShouldSetCapture,
        onPanResponderMove: onDragMove,
        onPanResponderRelease: onDragRelease,
        onPanResponderTerminate: onDragTerminate,
      }),
    [moveShouldSetCapture, onDragMove, onDragRelease, onDragTerminate],
  );

  const content = (
    <>
      {/* Header */}
      {isPhone ? (
        <TouchableOpacity
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={requestClose}
          style={styles.handle}>
          <View style={[styles.handleBar, { backgroundColor: theme.textMuted }]} />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {!isPhone ? (
          <TouchableOpacity
            onPress={requestClose}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceHighlight }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: "bold" }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        onScroll={onBodyScroll}
        scrollEventThrottle={16}>
        {children}
      </ScrollView>

      {/* Footer */}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View>
      ) : null}
    </>
  );

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      // On the web, RN Modal fires onRequestClose on Escape keyup as well, which would run the
      // close path twice per key press with the keydown listener above. So the web Escape path is
      // that listener alone; onRequestClose stays for the native Android Back button.
      onRequestClose={Platform.OS === "web" ? undefined : requestClose}>
      <View
        style={[
          styles.overlay,
          isPhone ? [styles.sheetOverlay, { paddingBottom: insets.bottom }] : { paddingBottom: Math.max(16, insets.bottom + 16) },
        ]}>
        <Pressable style={styles.backdrop} onPress={requestClose} />
        {isPhone ? (
          <Animated.View
            testID="modal-sheet"
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                maxHeight: `${Math.min(maxHeightPercent, SHEET_MAX_HEIGHT_PERCENT)}%`,
                transform: [{ translateY: dragY }],
              },
            ]}
            {...sheetPanResponder.panHandlers}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.sheetInner}>
              {content}
            </KeyboardAvoidingView>
          </Animated.View>
        ) : (
          <KeyboardAvoidingView
            testID="modal-sheet"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[
              styles.container,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                maxHeight: `${maxHeightPercent}%`,
              },
            ]}>
            {content}
          </KeyboardAvoidingView>
        )}

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
  sheetOverlay: {
    justifyContent: "flex-end",
    alignItems: "stretch",
    padding: 0,
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
    maxWidth: 560,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    // A drag on the sheet must not turn into a native text selection, which would cancel the gesture.
    userSelect: "none",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetInner: {
    flexShrink: 1,
  },
  handle: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
