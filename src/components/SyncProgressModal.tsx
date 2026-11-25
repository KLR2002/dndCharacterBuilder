import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface SyncProgressModalProps {
  visible: boolean;
  /** The category being downloaded, with its 1-based step out of the total. */
  category: string;
  step: number;
  total: number;
  /** Set when the download failed: the window shows the error and closes only through onClose. */
  error: string | null;
  onClose: () => void;
}

/** The progress window for a Compendium download: the full sync and the beasts-only download both use it. */
export function SyncProgressModal({ visible, category, step, total, error, onClose }: SyncProgressModalProps) {
  const { theme } = useAppTheme();
  return (
    <Modal
      visible={visible}
      onClose={() => {
        if (error) onClose();
      }}
      title={error ? "Integration Error" : "Syncing Compendium"}
      subtitle={error ? undefined : `Category ${step} of ${total}`}
      footer={
        error ? (
          <Button title="Close" variant="secondary" onPress={onClose} />
        ) : undefined
      }
    >
      {error ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.accentHover, fontSize: 14 }}>
            Failed to complete integration: {error}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            Please check your internet connection and try again.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16, paddingVertical: 8 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
            Downloading {category}...
          </Text>
          <View
            style={{
              width: "100%",
              height: 8,
              backgroundColor: theme.surfaceHighlight,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.round((step / total) * 100)}%`,
                height: "100%",
                backgroundColor: theme.accent,
              }}
            />
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            Downloading catalog datasets directly into local IndexedDB storage.
          </Text>
        </View>
      )}
    </Modal>
  );
}
