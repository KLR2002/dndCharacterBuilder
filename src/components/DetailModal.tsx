import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { Badge } from "./ui/Badge";
import { Modal } from "./ui/Modal";

interface DetailItem {
  title: string;
  subtitle?: string;
  source?: string;
  tags?: string[];
  description?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export interface DetailModalProps {
  item?: DetailItem | null;
  visible?: boolean;
  title?: string;
  subtitle?: string;
  content?: string;
  source?: string;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  visible,
  title,
  subtitle,
  content,
  source,
  onClose,
}) => {
  const { theme } = useAppTheme();

  const isVisible = visible !== undefined ? visible : Boolean(item);
  if (!isVisible) return null;

  const displayTitle = item?.title || title || "";
  const displaySubtitle = item?.subtitle || subtitle;
  const displaySource = item?.source || source;
  const displayDescription = item?.description || content || "No description provided.";
  const displayTags = item?.tags || [];
  const displayMeta = item?.meta;

  return (
    <Modal
      visible={isVisible}
      onClose={onClose}
      title={displayTitle}
      subtitle={displaySubtitle}>
      <View style={styles.container}>
        {/* Badges / Tags */}
        <View style={styles.badgeRow}>
          {displaySource ? <Badge label={displaySource} variant="accent" size="sm" /> : null}
          {displayTags.map((t, idx) => (
            <Badge key={idx} label={t} variant="surface" size="sm" />
          ))}
        </View>

        {/* Key-Value Meta attributes if provided */}
        {displayMeta && Object.keys(displayMeta).length > 0 ? (
          <View style={[styles.metaBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            {Object.entries(displayMeta).map(([k, v]) => {
              if (v == null || v === "") return null;
              return (
                <View key={k} style={styles.metaRow}>
                  <Text style={[styles.metaKey, { color: theme.textSecondary }]}>{k}:</Text>
                  <Text style={[styles.metaVal, { color: theme.text }]}>{String(v)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Description */}
        <Text style={[styles.description, { color: theme.text }]}>
          {displayDescription}
        </Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaKey: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaVal: {
    fontSize: 12,
    fontWeight: "500",
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
});
