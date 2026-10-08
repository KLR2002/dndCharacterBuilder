import React, { useMemo, useState } from "react";
import {
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { getItems } from "../../services/dataService";
import { evaluateCharacter } from "../../services/dndRules";
import { InventoryItem } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { DetailModal } from "../DetailModal";
import { SearchBar } from "../ui/SearchBar";
import { ActiveInfusionsSection } from "../ActiveInfusionsSection";

const COIN_TYPES: ("cp" | "sp" | "ep" | "gp" | "pp")[] = ["cp", "sp", "ep", "gp", "pp"];

function makeItemId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const InventoryTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [customItemVisible, setCustomItemVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string | null>(null);

  // Custom Item Form State
  const [customName, setCustomName] = useState("");
  const [customWeight, setCustomWeight] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [customDamage, setCustomDamage] = useState("");
  const [customAc, setCustomAc] = useState("");
  const [customBonusWeapon, setCustomBonusWeapon] = useState("");
  const [customBonusAc, setCustomBonusAc] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customSection, setCustomSection] = useState<"equipped" | "carried">("carried");

  const [detailModal, setDetailModal] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  const [attunementSwapModal, setAttunementSwapModal] = useState<{
    visible: boolean;
    targetItem?: InventoryItem;
  }>({ visible: false });

  // Library Items
  const allLibraryItems = useMemo(() => getItems(activeBooks), [activeBooks]);
  const filteredLibraryItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allLibraryItems.filter((i) => {
      const matchesSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.type || "").toLowerCase().includes(q) ||
        (i.itemCategory || "").toLowerCase().includes(q);

      const matchesType =
        !itemTypeFilter ||
        (i.itemCategory && i.itemCategory.toLowerCase() === itemTypeFilter.toLowerCase()) ||
        (i.type && i.type.toLowerCase() === itemTypeFilter.toLowerCase()) ||
        (i.type && i.type.toLowerCase().includes(itemTypeFilter.toLowerCase()));

      return matchesSearch && matchesType;
    });
  }, [allLibraryItems, searchQuery, itemTypeFilter]);

  const evaluated = useMemo(() => {
    if (!currentCharacter) return null;
    return evaluateCharacter(currentCharacter);
  }, [currentCharacter]);

  if (!currentCharacter || !evaluated) return null;

  const items = currentCharacter.items || [];
  const pouch = currentCharacter.pouch || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const { currentWeight, maxCapacity, encumbered, heavilyEncumbered } = evaluated.carryingWeight;

  // Separate equipped vs carried
  const equippedItems = items.filter((i) => i.isEquipped || i.section === "equipped");
  const carriedItems = items.filter((i) => !i.isEquipped && i.section !== "equipped");

  // Currency Handlers
  const updateCoin = (coin: "cp" | "sp" | "ep" | "gp" | "pp", delta: number) => {
    const current = pouch[coin] || 0;
    const next = Math.max(0, current + delta);
    updateCharacter(currentCharacter.id, {
      pouch: {
        ...pouch,
        [coin]: next,
      },
    });
  };

  const setCoinDirect = (coin: "cp" | "sp" | "ep" | "gp" | "pp", text: string) => {
    const val = parseInt(text, 10);
    updateCharacter(currentCharacter.id, {
      pouch: {
        ...pouch,
        [coin]: isNaN(val) ? 0 : Math.max(0, val),
      },
    });
  };

  // Item Handlers
  const toggleEquip = (item: InventoryItem) => {
    const newEquipped = !item.isEquipped;
    const updated = items.map((i) => {
      if (i.id === item.id) {
        return {
          ...i,
          isEquipped: newEquipped,
          section: (newEquipped ? "equipped" : "carried") as "equipped" | "carried",
        };
      }
      return i;
    });
    updateCharacter(currentCharacter.id, { items: updated });
  };

  const updateItemQuantity = (id: string, delta: number) => {
    const updated = items
      .map((i) => {
        if (i.id === id) {
          const nextQ = i.quantity + delta;
          return nextQ > 0 ? { ...i, quantity: nextQ } : null;
        }
        return i;
      })
      .filter((i): i is InventoryItem => i !== null);
    updateCharacter(currentCharacter.id, { items: updated });
  };

  const removeItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    updateCharacter(currentCharacter.id, { items: updated });
  };

  const attunedItems = items.filter(
    (i) => Boolean(i.attunement) && i.isAttuned === true
  );
  const attunedCount = attunedItems.length;

  const toggleAttune = (item: InventoryItem) => {
    if (item.isAttuned) {
      const updated = items.map((i) => (i.id === item.id ? { ...i, isAttuned: false } : i));
      updateCharacter(currentCharacter.id, { items: updated });
    } else {
      if (attunedCount >= 3) {
        setAttunementSwapModal({ visible: true, targetItem: item });
      } else {
        const updated = items.map((i) => (i.id === item.id ? { ...i, isAttuned: true } : i));
        updateCharacter(currentCharacter.id, { items: updated });
      }
    }
  };

  const swapAttunement = (itemToUnattune: InventoryItem) => {
    const target = attunementSwapModal.targetItem;
    if (!target) return;
    const updated = items.map((i) => {
      if (i.id === itemToUnattune.id) return { ...i, isAttuned: false };
      if (i.id === target.id) return { ...i, isAttuned: true };
      return i;
    });
    updateCharacter(currentCharacter.id, { items: updated });
    setAttunementSwapModal({ visible: false, targetItem: undefined });
  };

  const addItemFromLibrary = (itemData: any) => {
    const newItem: InventoryItem = {
      id: makeItemId("item"),
      name: itemData.name,
      source: itemData.source || "PHB",
      quantity: 1,
      isEquipped: false,
      section: "carried",
      weight: itemData.weight ?? null,
      cost: itemData.cost || itemData.value || null,
      damage: itemData.damage || itemData.dmg1 || null,
      damageType: itemData.damageType || itemData.dmgType || null,
      range: itemData.range || null,
      ac: itemData.ac ?? null,
      rarity: itemData.rarity || "None",
      attunement: itemData.attunement || false,
      isAttuned: false,
      bonusWeapon: itemData.bonusWeapon != null ? itemData.bonusWeapon : undefined,
      bonusAc: itemData.bonusAc != null ? itemData.bonusAc : undefined,
      itemCategory: itemData.itemCategory || undefined,
      description: itemData.description || (Array.isArray(itemData.rawEntries) ? itemData.rawEntries.join("\n") : "") || "",
    };
    updateCharacter(currentCharacter.id, { items: [...items, newItem] });
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;
    const parsedBonusFromName = (() => {
      const m = customName.trim().match(/\+(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    })();
    const bonusWeaponVal = customBonusWeapon.trim()
      ? parseInt(customBonusWeapon, 10)
      : (customDamage.trim() ? parsedBonusFromName : undefined);
    const bonusAcVal = customBonusAc.trim()
      ? parseInt(customBonusAc, 10)
      : (customAc.trim() ? parsedBonusFromName : undefined);

    const newItem: InventoryItem = {
      id: makeItemId("custom"),
      name: customName.trim(),
      source: "Custom",
      quantity: 1,
      isEquipped: customSection === "equipped",
      section: customSection,
      weight: customWeight ? parseFloat(customWeight) : null,
      cost: customCost.trim() || null,
      damage: customDamage.trim() || null,
      ac: customAc ? parseInt(customAc, 10) : null,
      description: customDesc.trim() || "",
      isCustom: true,
      bonusWeapon: bonusWeaponVal,
      bonusAc: bonusAcVal,
    };
    updateCharacter(currentCharacter.id, { items: [...items, newItem] });
    setCustomName("");
    setCustomWeight("");
    setCustomCost("");
    setCustomDamage("");
    setCustomAc("");
    setCustomBonusWeapon("");
    setCustomBonusAc("");
    setCustomDesc("");
    setCustomItemVisible(false);
  };

  const showItemDetail = (item: InventoryItem) => {
    let text = "";
    if (item.damage) text += `• Damage: ${item.damage} ${item.damageType || ""}\n`;
    if (item.ac != null) text += `• Armor Class: ${item.ac}\n`;
    if (item.weight != null) text += `• Weight: ${item.weight} lb\n`;
    if (item.cost) text += `• Value: ${item.cost}\n`;
    if (item.range) text += `• Range: ${item.range}\n`;
    if (item.rarity && item.rarity !== "None") text += `• Rarity: ${item.rarity}\n`;
    if (item.bonusWeapon) text += `• Enhancement Bonus: +${item.bonusWeapon} (Attack & Damage)\n`;
    if (item.bonusAc) text += `• Armor Class Bonus: +${item.bonusAc}\n`;
    if (item.attunement) {
      const attuneStr = typeof item.attunement === "string" ? item.attunement : "requires attunement";
      text += `• Attunement: ${attuneStr} (${item.isAttuned ? "Currently Attuned" : "Not Attuned"})\n`;
    }
    if (text) text += "\n";
    text += item.description || "No further details available.";

    setDetailModal({
      visible: true,
      title: item.name,
      subtitle: `${item.isEquipped ? "Equipped" : "Carried"} (${item.source})`,
      content: text,
    });
  };

  // Calculate Total Wealth in GP
  const totalWealthInGp = Math.round(
    (pouch.pp * 10 + pouch.gp + pouch.ep * 0.5 + pouch.sp * 0.1 + pouch.cp * 0.01) * 100
  ) / 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Currency Pouch */}
      <Card style={styles.pouchCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>CURRENCY POUCH</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Total Wealth: ~{totalWealthInGp} gp
            </Text>
          </View>
          <Ionicons name="wallet-outline" size={22} color={theme.accent} />
        </View>

        <View style={styles.coinsRow}>
          {COIN_TYPES.map((coin) => (
            <View key={coin} style={[styles.coinBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
              <Text style={[styles.coinLabel, { color: coin === "gp" ? "#f59e0b" : coin === "pp" ? "#c084fc" : coin === "sp" ? "#cbd5e1" : coin === "ep" ? "#67e8f9" : "#b45309" }]}>
                {coin.toUpperCase()}
              </Text>
              <TextInput
                style={[styles.coinInput, { color: theme.text }]}
                value={String(pouch[coin] || 0)}
                onChangeText={(t) => setCoinDirect(coin, t)}
                keyboardType="number-pad"
              />
              <View style={styles.coinStepper}>
                <TouchableOpacity onPress={() => updateCoin(coin, -1)} style={styles.coinStepBtn}>
                  <Ionicons name="remove" size={12} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => updateCoin(coin, 1)} style={styles.coinStepBtn}>
                  <Ionicons name="add" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* Weight Limit Toggle & Capacity Bar */}
      <Card style={styles.weightCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>CARRYING WEIGHT</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Str × 15 = {maxCapacity} lbs capacity
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Limit Tracking</Text>
            <Switch
              value={currentCharacter.useWeightLimit || false}
              onValueChange={(val) => updateCharacter(currentCharacter.id, { useWeightLimit: val })}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {currentCharacter.useWeightLimit && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: isCompact ? "column" : "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: currentWeight > maxCapacity ? theme.danger : theme.text, fontWeight: "600", fontSize: 13 }}>
                {currentWeight} lbs carried
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: isCompact ? 2 : 0 }}>
                Max {maxCapacity} lbs
              </Text>
            </View>
            <View style={[styles.weightBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
              <View
                style={[
                  styles.weightBarFill,
                  {
                    backgroundColor: currentWeight > maxCapacity ? theme.danger : heavilyEncumbered ? theme.warning : theme.accent,
                    width: `${Math.min(100, (currentWeight / maxCapacity) * 100)}%`,
                  },
                ]}
              />
            </View>
            {encumbered && (
              <Text style={{ color: heavilyEncumbered ? theme.danger : theme.warning, fontSize: 12, marginTop: 4 }}>
                ⚠️ {heavilyEncumbered ? "Heavily Encumbered (speed drops 20 ft, disadvantage on ability checks/attack rolls)" : "Encumbered (speed drops 10 ft)"}
              </Text>
            )}
          </View>
        )}
      </Card>

      {/* Attunement Ledger */}
      <Card style={[styles.attunementCard, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 16 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="sparkles" size={18} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>ATTUNEMENT</Text>
          </View>
          <Badge
            label={`Attuned: ${attunedCount} / 3`}
            variant={attunedCount >= 3 ? "accent" : "outline"}
            size="md"
          />
        </View>
        {attunedCount > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {attunedItems.map((item) => (
              <Badge key={item.id} label={item.name} variant="accent" size="sm" />
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
            No items actively attuned (3 slots available).
          </Text>
        )}
      </Card>

      {/* Inventory Action Buttons */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Button
          title="Add from Compendium"
          icon="search"
          variant="primary"
          size="sm"
          onPress={() => setItemPickerVisible(true)}
          style={{ flex: 1 }}
        />
        <Button
          title="Custom Item"
          icon="add"
          variant="secondary"
          size="sm"
          onPress={() => setCustomItemVisible(true)}
          style={{ flex: 1 }}
        />
      </View>

      {/* ACTIVE INFUSIONS (ARTIFICER) */}
      <ActiveInfusionsSection />

      {/* EQUIPPED SECTION */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Ionicons name="shield" size={16} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            EQUIPPED GEAR ({equippedItems.length})
          </Text>
        </View>

        {equippedItems.length === 0 ? (
          <Card style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>No items equipped.</Text>
          </Card>
        ) : (
          <Card style={{ padding: 4 }}>
            {equippedItems.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: idx === equippedItems.length - 1 ? 0 : 1,
                  },
                ]}>
                {/* Equip Toggle */}
                <TouchableOpacity onPress={() => toggleEquip(item)} style={styles.equipBtn}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                </TouchableOpacity>

                {/* Item Info (click to view details) */}
                <TouchableOpacity onPress={() => showItemDetail(item)} style={{ flex: 1, paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={isCompact ? 2 : 1}>{item.name}</Text>
                    {item.infusedWith && (
                      <Badge label={item.infusedWith} variant="accent" size="sm" />
                    )}
                    {item.attunement ? (
                      item.isAttuned ? (
                        <Badge label="Attuned" variant="accent" size="sm" />
                      ) : (
                        <Badge label="Unattuned" variant="warning" size="sm" />
                      )
                    ) : null}
                    {item.rarity && item.rarity !== "None" && (
                      <Badge label={item.rarity} variant="outline" size="sm" />
                    )}
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={isCompact ? 2 : 1}>
                    {item.damage ? `${item.damage} • ` : ""}{item.ac ? `AC ${item.ac} • ` : ""}{item.weight != null ? `${item.weight} lb • ` : ""}{item.source}
                  </Text>
                </TouchableOpacity>

                {/* Attune Button */}
                {item.attunement ? (
                  <TouchableOpacity
                    onPress={() => toggleAttune(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.attuneToggleBtn,
                      {
                        backgroundColor: item.isAttuned ? theme.surfaceHighlight : theme.accent,
                        borderColor: item.isAttuned ? theme.border : theme.accent,
                      },
                    ]}>
                    <Text
                      style={{
                        color: item.isAttuned ? theme.accent : "#ffffff",
                        fontSize: 11,
                        fontWeight: "600",
                      }}>
                      {item.isAttuned ? "Unattune" : "Attune"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Quantity */}
                <View style={[styles.qtyControl, isCompact && { alignSelf: "flex-end" }]}>
                  <TouchableOpacity onPress={() => updateItemQuantity(item.id, -1)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateItemQuantity(item.id, 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Delete */}
                <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* CARRIED / BACKPACK SECTION */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Ionicons name="briefcase" size={16} color={theme.textSecondary} />
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            BACKPACK & CARRIED ITEMS ({carriedItems.length})
          </Text>
        </View>

        {carriedItems.length === 0 ? (
          <Card style={{ padding: 16, alignItems: "center" }}>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>No carried items.</Text>
          </Card>
        ) : (
          <Card style={{ padding: 4 }}>
            {carriedItems.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: idx === carriedItems.length - 1 ? 0 : 1,
                  },
                ]}>
                {/* Equip Toggle */}
                <TouchableOpacity onPress={() => toggleEquip(item)} style={styles.equipBtn}>
                  <Ionicons name="ellipse-outline" size={20} color={theme.border} />
                </TouchableOpacity>

                {/* Item Info */}
                <TouchableOpacity onPress={() => showItemDetail(item)} style={{ flex: 1, paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={isCompact ? 2 : 1}>{item.name}</Text>
                    {item.infusedWith && (
                      <Badge label={item.infusedWith} variant="accent" size="sm" />
                    )}
                    {item.attunement ? (
                      item.isAttuned ? (
                        <Badge label="Attuned" variant="accent" size="sm" />
                      ) : (
                        <Badge label="Unattuned" variant="warning" size="sm" />
                      )
                    ) : null}
                    {item.rarity && item.rarity !== "None" && (
                      <Badge label={item.rarity} variant="outline" size="sm" />
                    )}
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={isCompact ? 2 : 1}>
                    {item.weight != null ? `${item.weight} lb • ` : ""}{item.cost ? `${item.cost} • ` : ""}{item.source}
                  </Text>
                </TouchableOpacity>

                {/* Attune Button */}
                {item.attunement ? (
                  <TouchableOpacity
                    onPress={() => toggleAttune(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.attuneToggleBtn,
                      {
                        backgroundColor: item.isAttuned ? theme.surfaceHighlight : theme.accent,
                        borderColor: item.isAttuned ? theme.border : theme.accent,
                      },
                    ]}>
                    <Text
                      style={{
                        color: item.isAttuned ? theme.accent : "#ffffff",
                        fontSize: 11,
                        fontWeight: "600",
                      }}>
                      {item.isAttuned ? "Unattune" : "Attune"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Quantity */}
                <View style={[styles.qtyControl, isCompact && { alignSelf: "flex-end" }]}>
                  <TouchableOpacity onPress={() => updateItemQuantity(item.id, -1)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateItemQuantity(item.id, 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Delete */}
                <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* Item Compendium Picker Modal */}
      <RNModal visible={itemPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Add Item from Compendium</Text>
              <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search weapons, armor, adventuring gear..."
            />

            {/* Filter Categories */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, height: 38, marginVertical: 8 }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              {[
                "All",
                "Weapon",
                "Armor",
                "Shield",
                "Potion",
                "Ring",
                "Rod",
                "Wand",
                "Scroll",
                "Staff",
                "Wondrous Item",
                "Adventuring Gear",
                "Tool",
              ].map((t) => (
                <TouchableOpacity
                  key={t}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  onPress={() => setItemTypeFilter(t === "All" ? null : t)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor:
                        (t === "All" && itemTypeFilter === null) || itemTypeFilter === t
                          ? theme.accent
                          : theme.surfaceHighlight,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }}>
              {filteredLibraryItems.slice(0, 100).map((it) => (
                <View
                  key={`${it.name}_${it.source}`}
                  style={[styles.pickerItemRow, { borderBottomColor: theme.border }]}>
                  <TouchableOpacity
                    onPress={() =>
                      setDetailModal({
                        visible: true,
                        title: it.name,
                        subtitle: `${it.type || "Item"} (${it.source})`,
                        content: `• Value: ${it.cost || "N/A"}\n• Weight: ${it.weight != null ? `${it.weight} lb` : "N/A"}\n• Damage: ${it.damage || "N/A"}\n• AC: ${it.ac ?? "N/A"}\n\n${it.description || "No description."}`,
                      })
                    }
                    style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>{it.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                        {it.type || "Item"} • {it.weight != null ? `${it.weight} lb` : ""} • {it.source}
                      </Text>
                      {it.rarity && it.rarity !== "None" && (
                        <Badge label={it.rarity} variant="surface" size="sm" />
                      )}
                      {Boolean(it.attunement) && (
                        <Badge label="Attunement" variant="secondary" size="sm" />
                      )}
                      {it.bonusWeapon != null && (
                        <Badge label={`+${it.bonusWeapon} Hit/Dmg`} variant="accent" size="sm" />
                      )}
                      {it.bonusAc != null && (
                        <Badge label={`+${it.bonusAc} AC`} variant="accent" size="sm" />
                      )}
                    </View>
                  </TouchableOpacity>

                  <Button
                    title="Add"
                    size="sm"
                    variant="primary"
                    onPress={() => addItemFromLibrary(it)}
                  />
                </View>
              ))}
            </ScrollView>
          </Card>
        </View>
      </RNModal>

      {/* Custom Item Modal */}
      <RNModal visible={customItemVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.customItemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Add Custom Item</Text>
              <TouchableOpacity onPress={() => setCustomItemVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.fieldLabel}>Item Name *</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Mithral Longsword"
                placeholderTextColor={theme.textMuted}
              />

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Weight (lbs)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customWeight}
                    onChangeText={setCustomWeight}
                    keyboardType="numeric"
                    placeholder="3"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Cost / Value</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customCost}
                    onChangeText={setCustomCost}
                    placeholder="15 gp"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Damage (if weapon)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customDamage}
                    onChangeText={setCustomDamage}
                    placeholder="1d8 slashing"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>AC (if armor)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customAc}
                    onChangeText={setCustomAc}
                    keyboardType="number-pad"
                    placeholder="16"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Weapon Bonus (+1, +2, +3)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customBonusWeapon}
                    onChangeText={setCustomBonusWeapon}
                    keyboardType="number-pad"
                    placeholder="e.g. 1"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>AC Bonus (+1, +2, +3)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                    value={customBonusAc}
                    onChangeText={setCustomBonusAc}
                    keyboardType="number-pad"
                    placeholder="e.g. 1"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Initial Placement</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setCustomSection("carried")}
                  style={[
                    styles.placementBtn,
                    {
                      backgroundColor: customSection === "carried" ? theme.accent : theme.surfaceHighlight,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Backpack (Carried)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCustomSection("equipped")}
                  style={[
                    styles.placementBtn,
                    {
                      backgroundColor: customSection === "equipped" ? theme.accent : theme.surfaceHighlight,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Equipped</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Description / Notes</Text>
              <TextInput
                style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                value={customDesc}
                onChangeText={setCustomDesc}
                multiline
                numberOfLines={3}
                placeholder="Properties, magic effects, lore..."
                placeholderTextColor={theme.textMuted}
              />
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => setCustomItemVisible(false)} />
              <Button title="Save Item" variant="primary" size="sm" onPress={addCustomItem} />
            </View>
          </Card>
        </View>
      </RNModal>

      {/* Detail Modal */}
      <DetailModal
        visible={detailModal.visible}
        title={detailModal.title}
        subtitle={detailModal.subtitle}
        content={detailModal.content}
        onClose={() => setDetailModal({ visible: false, title: "", content: "" })}
      />

      {/* Attunement Swap Modal */}
      <RNModal
        visible={attunementSwapModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttunementSwapModal({ visible: false, targetItem: undefined })}>
        <View style={styles.modalOverlay}>
          <Card style={[styles.customItemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Attunement Limit Reached (3/3)</Text>
              <TouchableOpacity
                onPress={() => setAttunementSwapModal({ visible: false, targetItem: undefined })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
              You can only attune to a maximum of 3 magic items at a time. To attune to{" "}
              <Text style={{ color: theme.text, fontWeight: "700" }}>{attunementSwapModal.targetItem?.name}</Text>, select an item to unattune:
            </Text>
            {attunedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => swapAttunement(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: theme.surfaceHighlight,
                  borderRadius: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}>
                <View>
                  <Text style={{ color: theme.text, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>{item.source}</Text>
                </View>
                <Badge label="Swap" variant="outline" size="sm" />
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <Button
                title="Cancel"
                variant="secondary"
                size="sm"
                onPress={() => setAttunementSwapModal({ visible: false, targetItem: undefined })}
              />
            </View>
          </Card>
        </View>
      </RNModal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pouchCard: {
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  coinsRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  coinBox: {
    flex: 1,
    alignItems: "center",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  coinLabel: {
    fontSize: 11,
    fontWeight: "bold",
  },
  coinInput: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    paddingVertical: 2,
  },
  coinStepper: {
    flexDirection: "row",
    gap: 4,
  },
  coinStepBtn: {
    padding: 2,
  },
  weightCard: {
    padding: 14,
    marginBottom: 16,
  },
  weightBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  weightBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    flexWrap: "wrap",
  },
  equipBtn: {
    padding: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 18,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 620,
    height: "85%",
    padding: 16,
  },
  customItemCard: {
    width: "100%",
    maxWidth: 500,
    padding: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  pickerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  textArea: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
  },
  placementBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  attunementCard: {
    padding: 12,
  },
  attuneToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
});
