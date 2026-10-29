import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface CatalogUpdateModalProps {
  visible: boolean;
  onOpenSettings: () => void;
  onLater: () => void;
}

export const CatalogUpdateModal: React.FC<CatalogUpdateModalProps> = ({
  visible,
  onOpenSettings,
  onLater,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal
      visible={visible}
      onClose={onLater}
      title="App updated"
      footer={
        <View style={styles.footer}>
          <Button title="Later" variant="outline" size="md" onPress={onLater} />
          <Button title="Open Settings" size="md" onPress={onOpenSettings} />
        </View>
      }
    >
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Sync the catalog in Settings.
      </Text>
    </Modal>
  );
};

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
});
