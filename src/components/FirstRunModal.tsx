import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";

interface FirstRunModalProps {
  visible: boolean;
  onComplete: (activeBooks?: string[]) => void;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({
  visible,
  onComplete,
}) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  return (
    <Modal
      visible={visible}
      onClose={() => onComplete()}
      title="Welcome to D&D Character Builder"
      subtitle="Your offline-first companion for D&D 5e (2014 ruleset)"
      maxHeightPercent={90}
      footer={
        <View
          style={[
            styles.footer,
            isCompact ? styles.footerCompact : styles.footerWide,
          ]}
        >
          <Text
            style={[
              styles.footerText,
              isCompact && styles.footerTextCompact,
              { color: theme.textSecondary },
            ]}
          >
            You can customize sourcebooks anytime in Settings.
          </Text>
          <Button
            title="Start Building Characters"
            onPress={() => onComplete()}
            size="md"
            style={isCompact ? styles.actionBtnCompact : undefined}
          />
        </View>
      }
    >
      <View style={styles.content}>
        {/* SRD Baseline Info Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: theme.surfaceHighlight },
              ]}
            >
              <Ionicons name="book-outline" size={22} color={theme.accent} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                SRD 5.1 Baseline Included
              </Text>
              <Badge
                label="OGL / SRD 5.1"
                size="sm"
                variant="accent"
                style={styles.badge}
              />
            </View>
          </View>
          <Text
            style={[styles.cardDescription, { color: theme.textSecondary }]}
          >
            Out of the box, the app includes the complete 2014 System Reference
            Document (SRD 5.1). This gives you instant access to:
          </Text>
          <View style={styles.featureList}>
            <Text style={[styles.featureItem, { color: theme.text }]}>
              • 12 Classes with their SRD archetypes (Champion, Life, Evocation,
              etc.)
            </Text>
            <Text style={[styles.featureItem, { color: theme.text }]}>
              • 9 Core Races and subraces (Elf, Dwarf, Human, Tiefling, etc.)
            </Text>
            <Text style={[styles.featureItem, { color: theme.text }]}>
              • Hundreds of SRD Spells, Magic Items, and Wild Shape Beasts
            </Text>
            <Text style={[styles.featureItem, { color: theme.text }]}>
              • Standard Backgrounds, Conditions, and Progression Rules
            </Text>
          </View>
        </Card>

        {/* 5eTools Integration Notice Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: theme.surfaceHighlight },
              ]}
            >
              <Ionicons
                name="cloud-download-outline"
                size={22}
                color={theme.accent}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                5eTools Integration
              </Text>
              <Badge
                label="In Settings"
                size="sm"
                variant="surface"
                style={styles.badge}
              />
            </View>
          </View>
          <Text
            style={[styles.cardDescription, { color: theme.textSecondary }]}
          >
            To protect copyright, no commercial expansion sourcebooks are
            bundled with this application.
          </Text>
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={theme.accent}
              style={{ marginTop: 2 }}
            />
            <Text style={[styles.noticeText, { color: theme.text }]}>
              If you legally own official 5e supplements, you can enable the{" "}
              <Text style={{ fontWeight: "bold" }}>5eTools Integration</Text> in
              Settings to sync and reference your owned material directly in
              your local device storage.
            </Text>
          </View>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    flexShrink: 1,
  },
  badge: {
    flexShrink: 0,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureList: {
    gap: 6,
    paddingLeft: 4,
  },
  featureItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    width: "100%",
  },
  footerCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  footerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerText: {
    fontSize: 13,
  },
  footerTextCompact: {
    textAlign: "center",
  },
  actionBtnCompact: {
    width: "100%",
  },
});
