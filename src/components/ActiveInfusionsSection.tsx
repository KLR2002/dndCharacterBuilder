import React, { useMemo, useState } from "react";
import {
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { getItems } from "../services/dataService";
import {
  findArtificerInfusion,
  getKnownInfusions,
  getMaxActiveInfusions,
  isMundaneItem,
} from "../rules/ruleChoices";
import { InventoryItem } from "../types/character";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";

export const ActiveInfusionsSection: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [targetSelectModal, setTargetSelectModal] = useState<{
    visible: boolean;
    infusionName: string;
  }>({ visible: false, infusionName: "" });

  const allLibraryItems = useMemo(() => getItems(activeBooks), [activeBooks]);

  if (!currentCharacter) return null;

  const maxActive = getMaxActiveInfusions(currentCharacter);
  if (maxActive <= 0) return null;

  const knownInfusions = getKnownInfusions(currentCharacter);
  const activeInfusions = currentCharacter.activeInfusions || [];
  const activeCount = activeInfusions.length;
  const isAtLimit = activeCount >= maxActive;

  const handleDeactivate = (infusionName: string) => {
    const isReplicated = infusionName.toLowerCase().startsWith("replicate magic item:");
    const existingActive = activeInfusions.find(
      (a) => a.infusionName.toLowerCase() === infusionName.toLowerCase()
    );

    const nextActive = activeInfusions.filter(
      (a) => a.infusionName.toLowerCase() !== infusionName.toLowerCase()
    );

    let nextItems = currentCharacter.items || [];
    if (isReplicated) {
      nextItems = nextItems.filter(
        (i) =>
          i.id !== existingActive?.targetItemId &&
          !(i.isInfused && i.infusedWith?.toLowerCase() === infusionName.toLowerCase())
      );
    } else {
      nextItems = nextItems.map((i) => {
        if (
          i.id === existingActive?.targetItemId ||
          i.infusedWith?.toLowerCase() === infusionName.toLowerCase()
        ) {
          const { infusedWith, isInfused, ...rest } = i;
          return rest as InventoryItem;
        }
        return i;
      });
    }

    updateCharacter(currentCharacter.id, {
      activeInfusions: nextActive,
      items: nextItems,
    });
  };

  const handleActivateReplicated = (infusionName: string) => {
    if (isAtLimit) return;
    const repItemName = infusionName.replace(/^Replicate Magic Item:\s*/i, "").trim();
    const libItem = allLibraryItems.find(
      (i) => i.name.toLowerCase() === repItemName.toLowerCase()
    );

    const newItemId = `infused_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: InventoryItem = {
      id: newItemId,
      name: repItemName,
      source: libItem?.source || "TCE",
      quantity: 1,
      isEquipped: false,
      section: "carried",
      weight: libItem?.weight ?? 0,
      cost: libItem?.cost,
      damage: libItem?.damage,
      damageType: libItem?.damageType,
      range: libItem?.range,
      ac: libItem?.ac,
      description: libItem?.description || `Replicated magic item created via ${infusionName}.`,
      isInfused: true,
      infusedWith: infusionName,
    };

    const nextActive = [
      ...activeInfusions,
      {
        infusionName,
        targetItemId: newItemId,
        targetItemName: repItemName,
      },
    ];

    const nextItems = [...(currentCharacter.items || []), newItem];

    updateCharacter(currentCharacter.id, {
      activeInfusions: nextActive,
      items: nextItems,
    });
  };

  const handleOpenItemPicker = (infusionName: string) => {
    if (isAtLimit) return;
    setTargetSelectModal({ visible: true, infusionName });
  };

  const handleBindToItem = (item: InventoryItem) => {
    const infusionName = targetSelectModal.infusionName;
    if (!infusionName || isAtLimit || !isMundaneItem(item)) return;

    const nextItems = (currentCharacter.items || []).map((i) => {
      if (i.id === item.id || (item.id == null && i.name === item.name)) {
        return {
          ...i,
          isInfused: true,
          infusedWith: infusionName,
        };
      }
      return i;
    });

    const nextActive = [
      ...activeInfusions,
      {
        infusionName,
        targetItemId: item.id,
        targetItemName: item.name,
      },
    ];

    updateCharacter(currentCharacter.id, {
      activeInfusions: nextActive,
      items: nextItems,
    });

    setTargetSelectModal({ visible: false, infusionName: "" });
  };

  const inventoryItems = currentCharacter.items || [];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="flash" size={18} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>Active Infusions</Text>
        </View>
        <Badge
          label={`Infused Items: ${activeCount} / ${maxActive}`}
          variant={isAtLimit ? "warning" : "accent"}
        />
      </View>

      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Daily Artificer inventions and replicated magic items. Max {maxActive} active at once.
      </Text>

      {knownInfusions.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: theme.surfaceRaised }]}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No infusions known yet. Select known infusions in Class Progression.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {knownInfusions.map((infName) => {
            const isReplicated = infName.toLowerCase().startsWith("replicate magic item:");
            const activeEntry = activeInfusions.find(
              (a) => a.infusionName.toLowerCase() === infName.toLowerCase()
            );
            const isActive = Boolean(activeEntry);
            const def = findArtificerInfusion(infName);

            return (
              <View
                key={infName}
                style={[
                  styles.infusionRow,
                  {
                    backgroundColor: isActive ? theme.surfaceRaised : theme.surfaceHighlight,
                    borderColor: isActive ? theme.accent : theme.border,
                    flexDirection: isCompact ? "column" : "row",
                    alignItems: isCompact ? "flex-start" : "center",
                  },
                ]}
              >
                <View style={styles.infusionInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.infusionName, { color: theme.text }]}>{infName}</Text>
                    {isActive && (
                      <Badge label="Active" variant="success" size="sm" />
                    )}
                  </View>
                  {activeEntry?.targetItemName && !isReplicated && (
                    <Text style={[styles.targetLabel, { color: theme.accent }]}>
                      Infused: {activeEntry.targetItemName}
                    </Text>
                  )}
                  {def?.description ? (
                    <Text
                      numberOfLines={2}
                      style={[styles.infusionDesc, { color: theme.textMuted }]}
                    >
                      {def.description}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.actionContainer,
                    isCompact && { width: "100%", alignItems: "flex-end", marginTop: 6, marginLeft: 0 },
                  ]}
                >
                  {isActive ? (
                    <Button
                      title="Deactivate"
                      variant="outline"
                      size="sm"
                      onPress={() => handleDeactivate(infName)}
                    />
                  ) : isReplicated ? (
                    <Button
                      title="Replicate"
                      variant="primary"
                      size="sm"
                      disabled={isAtLimit}
                      onPress={() => handleActivateReplicated(infName)}
                    />
                  ) : (
                    <Button
                      title="Infuse Item"
                      variant="primary"
                      size="sm"
                      disabled={isAtLimit}
                      onPress={() => handleOpenItemPicker(infName)}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Target Item Selection Modal for Infusions */}
      <RNModal
        visible={targetSelectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetSelectModal({ visible: false, infusionName: "" })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Select Item to Infuse
              </Text>
              <TouchableOpacity
                onPress={() => setTargetSelectModal({ visible: false, infusionName: "" })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Apply {targetSelectModal.infusionName} to an item in your inventory:
            </Text>

            <ScrollView style={styles.modalScroll}>
              {inventoryItems.length === 0 ? (
                <Text style={[styles.modalEmpty, { color: theme.textMuted }]}>
                  No items in inventory. Add an item in the Inventory tab first.
                </Text>
              ) : (
                inventoryItems.map((item, idx) => {
                  const isMundane = isMundaneItem(item);
                  return (
                    <TouchableOpacity
                      key={item.id ?? `${item.name}_${idx}`}
                      disabled={!isMundane}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.itemOption,
                        {
                          backgroundColor: theme.surfaceHighlight,
                          borderColor: item.isInfused ? theme.accent : theme.border,
                          minHeight: 44,
                          opacity: isMundane ? 1 : 0.6,
                        },
                      ]}
                      onPress={() => isMundane && handleBindToItem(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemOptionName, { color: isMundane ? theme.text : theme.textMuted }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemOptionMeta, { color: theme.textMuted }]}>
                          {item.isEquipped ? "Equipped" : "Carried"}
                          {item.infusedWith ? ` • Currently: ${item.infusedWith}` : ""}
                          {!isMundane ? " • Requires nonmagical object" : ""}
                        </Text>
                      </View>
                      {!isMundane ? (
                        <Badge label="Requires nonmagical object" variant="warning" size="sm" />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setTargetSelectModal({ visible: false, infusionName: "" })}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </RNModal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 10,
    marginVertical: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  list: {
    gap: 8,
    marginTop: 4,
  },
  infusionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  infusionInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infusionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  infusionDesc: {
    fontSize: 11,
  },
  actionContainer: {
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  modalScroll: {
    maxHeight: 340,
  },
  modalEmpty: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  itemOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  itemOptionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemOptionMeta: {
    fontSize: 11,
    marginTop: 2,
  },
});
