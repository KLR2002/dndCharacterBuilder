import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { getBeasts } from "../services/dataService";
import {
  getWildShapeLimits,
  isBeastEligible,
  getBeastFilterReason,
  getWildShapeCharges,
  getRequiredWildShapeCharges,
} from "../rules/wildShape";
import type { Character } from "../types/character";
import type { BeastData } from "../types/dnd5e";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";
import { FormattedDescription } from "./ui/FormattedDescription";

export interface WildShapeModalProps {
  visible: boolean;
  onClose: () => void;
  character: Character;
  onAdoptShape: (beast: BeastData) => void;
  onToggleFavorite: (beastKey: string) => void;
  activeBooks?: string[];
  onEnableMonsterManual?: () => void;
}

function formatMod(val: number): string {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export const WildShapeModal: React.FC<WildShapeModalProps> = ({
  visible,
  onClose,
  character,
  onAdoptShape,
  onToggleFavorite,
  activeBooks,
  onEnableMonsterManual,
}) => {
  const { theme } = useAppTheme();
  const { isCompact } = useResponsiveLayout();

  const [searchQuery, setSearchQuery] = useState("");
  const [crFilter, setCrFilter] = useState<string>("all");
  const [speedFilter, setSpeedFilter] = useState<"all" | "swim" | "fly">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showAllLocked, setShowAllLocked] = useState(false);
  const [inspectedBeast, setInspectedBeast] = useState<BeastData | null>(null);

  const limits = useMemo(() => getWildShapeLimits(character), [character]);
  const allBeasts = useMemo(() => getBeasts(activeBooks), [activeBooks]);

  const favoritesSet = useMemo(() => {
    return new Set(character.favoriteWildShapes || []);
  }, [character.favoriteWildShapes]);

  const currentWildShapeCharges = getWildShapeCharges(character);
  const isMmActive = useMemo(
    () => (activeBooks || []).some((b) => b.toUpperCase() === "MM"),
    [activeBooks]
  );

  // Filter beasts list
  const filteredBeasts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allBeasts.filter((beast) => {
      const isEligible = isBeastEligible(beast, character, activeBooks);
      if (!showAllLocked && !isEligible) {
        return false;
      }

      const beastKey = `${beast.name}__${beast.source}`;
      if (favoritesOnly && !favoritesSet.has(beastKey)) {
        return false;
      }

      if (q && !beast.name.toLowerCase().includes(q)) {
        return false;
      }

      if (crFilter !== "all" && beast.cr !== crFilter) {
        return false;
      }

      if (speedFilter === "swim" && (!beast.speed?.swim || beast.speed.swim <= 0)) {
        return false;
      }
      if (speedFilter === "fly" && (!beast.speed?.fly || beast.speed.fly <= 0)) {
        return false;
      }

      return true;
    });
  }, [
    allBeasts,
    character,
    activeBooks,
    showAllLocked,
    favoritesOnly,
    favoritesSet,
    searchQuery,
    crFilter,
    speedFilter,
  ]);

  if (!visible) return null;

  const crOptions = ["all", "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6"];

  return (
    <Modal
      visible={visible}
      onClose={() => {
        setInspectedBeast(null);
        onClose();
      }}
      title={inspectedBeast ? inspectedBeast.name : "Wild Shape Beast Browser"}
      subtitle={
        inspectedBeast
          ? `CR ${inspectedBeast.cr} • ${inspectedBeast.size} ${inspectedBeast.type}`
          : `Druid Lvl ${limits.druidLevel} • Max CR ${limits.maxCrDisplay} • Charges: ${currentWildShapeCharges}`
      }>
      {inspectedBeast ? (
        // ─── STATBLOCK INSPECTOR VIEW ─────────────────────────────────
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View style={{ gap: 12, paddingBottom: 16 }}>
            {/* Header Badges */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge label={`CR ${inspectedBeast.cr}`} variant="accent" size="sm" />
              <Badge label={inspectedBeast.size} variant="secondary" size="sm" />
              <Badge label={inspectedBeast.type} variant="secondary" size="sm" />
              <Badge label={inspectedBeast.source} variant="outline" size="sm" />
              {inspectedBeast.isElementalWildShape && (
                <Badge label="Circle of the Moon (2 Charges)" variant="warning" size="sm" />
              )}
            </View>

            {/* Combat Quick Stats */}
            <Card style={{ padding: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>ARMOR CLASS</Text>
                  <Text style={{ fontSize: 18, color: theme.text, fontWeight: "700" }}>{inspectedBeast.ac}</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>HIT POINTS</Text>
                  <Text style={{ fontSize: 18, color: theme.text, fontWeight: "700" }}>
                    {inspectedBeast.hp.average}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>({inspectedBeast.hp.formula})</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>SPEED</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {inspectedBeast.speed?.walk !== undefined && (
                      <Text style={{ fontSize: 13, color: theme.text }}>Walk {inspectedBeast.speed.walk}ft</Text>
                    )}
                    {inspectedBeast.speed?.swim !== undefined && (
                      <Text style={{ fontSize: 13, color: theme.accent, fontWeight: "600" }}>
                        Swim {inspectedBeast.speed.swim}ft
                      </Text>
                    )}
                    {inspectedBeast.speed?.fly !== undefined && (
                      <Text style={{ fontSize: 13, color: theme.warning, fontWeight: "600" }}>
                        Fly {inspectedBeast.speed.fly}ft
                      </Text>
                    )}
                    {inspectedBeast.speed?.climb !== undefined && (
                      <Text style={{ fontSize: 13, color: theme.text }}>Climb {inspectedBeast.speed.climb}ft</Text>
                    )}
                    {inspectedBeast.speed?.burrow !== undefined && (
                      <Text style={{ fontSize: 13, color: theme.text }}>Burrow {inspectedBeast.speed.burrow}ft</Text>
                    )}
                  </View>
                </View>
              </View>
            </Card>

            {/* Ability Scores Table */}
            <Card style={{ padding: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {(["str", "dex", "con", "int", "wis", "cha"] as const).map((ab) => {
                  const score = inspectedBeast.abilities[ab];
                  return (
                    <View key={ab} style={{ alignItems: "center", flex: 1 }}>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "700" }}>
                        {ab.toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 15, color: theme.text, fontWeight: "700", marginTop: 2 }}>
                        {score}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.accent }}>{formatMod(score)}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Senses & Skills */}
            {(inspectedBeast.senses || inspectedBeast.skills) && (
              <Card style={{ padding: 12 }}>
                {inspectedBeast.senses && inspectedBeast.senses.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: "600" }}>Senses:</Text>
                    <Text style={{ fontSize: 13, color: theme.text }}>{inspectedBeast.senses.join(", ")}</Text>
                  </View>
                )}
                {inspectedBeast.skills && (
                  <View>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: "600" }}>Skills:</Text>
                    <Text style={{ fontSize: 13, color: theme.text }}>
                      {Object.entries(inspectedBeast.skills)
                        .map(([sk, val]) => `${sk} ${val >= 0 ? `+${val}` : val}`)
                        .join(", ")}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Special Traits */}
            {inspectedBeast.traits && inspectedBeast.traits.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700" }}>TRAITS</Text>
                {inspectedBeast.traits.map((tr, idx) => (
                  <Card key={idx} style={{ padding: 10 }}>
                    <Text style={{ fontSize: 14, color: theme.text, fontWeight: "700", marginBottom: 4 }}>
                      {tr.name}
                    </Text>
                    <FormattedDescription content={tr.description} />
                  </Card>
                ))}
              </View>
            )}

            {/* Actions */}
            {inspectedBeast.actions && inspectedBeast.actions.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700" }}>ACTIONS</Text>
                {inspectedBeast.actions.map((act, idx) => (
                  <Card key={idx} style={{ padding: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, color: theme.text, fontWeight: "700" }}>{act.name}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {act.attackBonus !== undefined && (
                          <Badge
                            label={`${act.attackBonus >= 0 ? `+${act.attackBonus}` : act.attackBonus} to hit`}
                            variant="accent"
                            size="sm"
                          />
                        )}
                        {act.damageDice && (
                          <Badge label={`${act.damageDice} ${act.damageType || ""}`} variant="secondary" size="sm" />
                        )}
                      </View>
                    </View>
                    <FormattedDescription content={act.description} />
                  </Card>
                ))}
              </View>
            )}

            {/* Adopt / Back Action Buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Button
                title="Back to List"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setInspectedBeast(null)}
              />
              {(() => {
                const isEligible = isBeastEligible(inspectedBeast, character, activeBooks);
                const requiredCharges = getRequiredWildShapeCharges(inspectedBeast);
                const hasCharges = currentWildShapeCharges >= requiredCharges;

                return (
                  <Button
                    title={
                      !isEligible
                        ? "Shape Locked"
                        : !hasCharges
                        ? `Needs ${requiredCharges} Uses`
                        : `Adopt Shape (${requiredCharges} ${requiredCharges === 1 ? "use" : "uses"})`
                    }
                    variant="primary"
                    disabled={!isEligible || !hasCharges}
                    style={{ flex: 1.4 }}
                    onPress={() => {
                      onAdoptShape(inspectedBeast);
                      setInspectedBeast(null);
                      onClose();
                    }}
                  />
                );
              })()}
            </View>
          </View>
        </ScrollView>
      ) : (
        // ─── BROWSER CATALOG LIST VIEW ────────────────────────────────
        <View style={{ gap: 12 }}>
          {/* Monster Manual Inactive Warning */}
          {!isMmActive && (
            <Card
              style={{
                padding: 10,
                backgroundColor: theme.warning + "15",
                borderColor: theme.warning + "60",
                borderWidth: 1,
              }}>
              <View
                style={{
                  flexDirection: isCompact ? "column" : "row",
                  alignItems: isCompact ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="warning-outline" size={18} color={theme.warning} />
                  <Text style={{ color: theme.text, fontSize: 12, flex: 1 }}>
                    Monster Manual is not active in Active Books. Most beast shapes will not appear.
                  </Text>
                </View>
                {onEnableMonsterManual && (
                  <Button
                    title="Enable MM"
                    size="sm"
                    variant="outline"
                    onPress={onEnableMonsterManual}
                  />
                )}
              </View>
            </Card>
          )}

          {/* Search Input Bar */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
            ]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search beasts by name..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Filter Switches Row */}
          <View
            style={{
              flexDirection: isCompact ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isCompact ? "flex-start" : "center",
              flexWrap: "wrap",
              gap: 8,
            }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setFavoritesOnly((prev) => !prev)}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: favoritesOnly ? theme.accent : theme.surfaceRaised,
                    borderColor: theme.border,
                  },
                ]}>
                <Ionicons
                  name={favoritesOnly ? "star" : "star-outline"}
                  size={14}
                  color={favoritesOnly ? "#fff" : theme.accent}
                />
                <Text style={{ fontSize: 12, fontWeight: "600", color: favoritesOnly ? "#fff" : theme.text }}>
                  Favorites
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAllLocked((prev) => !prev)}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: showAllLocked ? theme.surfaceHighlight : theme.surfaceRaised,
                    borderColor: theme.border,
                  },
                ]}>
                <Ionicons
                  name={showAllLocked ? "eye" : "eye-off-outline"}
                  size={14}
                  color={theme.textSecondary}
                />
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary }}>
                  {showAllLocked ? "Showing All" : "Show All"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Movement Speed Filter Chips */}
            <View style={{ flexDirection: "row", gap: 4 }}>
              {(["all", "swim", "fly"] as const).map((sp) => (
                <TouchableOpacity
                  key={sp}
                  onPress={() => setSpeedFilter(sp)}
                  style={[
                    styles.speedChip,
                    {
                      backgroundColor: speedFilter === sp ? theme.accent : theme.surfaceRaised,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: speedFilter === sp ? "#fff" : theme.textSecondary,
                    }}>
                    {sp === "all" ? "All" : sp.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CR Filter Horizontal Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
              {crOptions.map((cr) => (
                <TouchableOpacity
                  key={cr}
                  onPress={() => setCrFilter(cr)}
                  style={[
                    styles.crChip,
                    {
                      backgroundColor: crFilter === cr ? theme.accent : theme.surfaceRaised,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: crFilter === cr ? "#fff" : theme.text,
                    }}>
                    {cr === "all" ? "All CR" : `CR ${cr}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Catalog Count Banner */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              Found {filteredBeasts.length} forms
            </Text>
            {limits.hasWildShape && (
              <Text style={{ fontSize: 12, color: theme.accent, fontWeight: "600" }}>
                Allowed: CR {limits.maxCrDisplay}
                {limits.canSwim ? " • Swim" : ""}
                {limits.canFly ? " • Fly" : ""}
              </Text>
            )}
          </View>

          {/* Beast Items Scrollable List */}
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {filteredBeasts.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Ionicons name="paw-outline" size={36} color={theme.textMuted} />
                <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 14 }}>
                  No beast shapes match the current filters.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8, paddingBottom: 16 }}>
                {filteredBeasts.map((beast) => {
                  const beastKey = `${beast.name}__${beast.source}`;
                  const isFavorited = favoritesSet.has(beastKey);
                  const isEligible = isBeastEligible(beast, character, activeBooks);
                  const lockReason = !isEligible ? getBeastFilterReason(beast, character) : null;
                  const requiredCharges = getRequiredWildShapeCharges(beast);
                  const hasCharges = currentWildShapeCharges >= requiredCharges;

                  return (
                    <Card
                      key={beastKey}
                      style={[
                        styles.beastCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          opacity: isEligible ? 1 : 0.65,
                        },
                      ]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        {/* Left Details */}
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => setInspectedBeast(beast)}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>
                              {beast.name}
                            </Text>
                            <Badge label={`CR ${beast.cr}`} variant="accent" size="sm" />
                            <Badge label={beast.size} variant="secondary" size="sm" />
                            <Badge label={beast.source} variant="outline" size="sm" />
                          </View>

                          {/* Quick Stats: HP, AC, Speed */}
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                              HP <Text style={{ color: theme.text, fontWeight: "600" }}>{beast.hp.average}</Text>
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                              AC <Text style={{ color: theme.text, fontWeight: "600" }}>{beast.ac}</Text>
                            </Text>
                            {beast.speed.walk !== undefined && (
                              <Text style={{ fontSize: 12, color: theme.textMuted }}>{beast.speed.walk}ft</Text>
                            )}
                            {beast.speed.swim !== undefined && (
                              <Text style={{ fontSize: 12, color: theme.accent }}>Swim {beast.speed.swim}ft</Text>
                            )}
                            {beast.speed.fly !== undefined && (
                              <Text style={{ fontSize: 12, color: theme.warning }}>Fly {beast.speed.fly}ft</Text>
                            )}
                          </View>

                          {/* Lock reason warning badge */}
                          {lockReason && (
                            <View style={{ marginTop: 6 }}>
                              <Badge label={lockReason} variant="warning" size="sm" />
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Right Action Icons: Favorite Star & Adopt Button */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => onToggleFavorite(beastKey)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={[
                              styles.iconBtn,
                              { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                            ]}>
                            <Ionicons
                              name={isFavorited ? "star" : "star-outline"}
                              size={18}
                              color={isFavorited ? "#FFD700" : theme.textMuted}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setInspectedBeast(beast)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[
                              styles.actionBtn,
                              { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                            ]}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text }}>Info</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              onAdoptShape(beast);
                              onClose();
                            }}
                            disabled={!isEligible || !hasCharges}
                            style={[
                              styles.adoptBtn,
                              {
                                backgroundColor: isEligible && hasCharges ? theme.accent : theme.border,
                              },
                            ]}>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: isEligible && hasCharges ? "#fff" : theme.textMuted,
                              }}>
                              Adopt
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 32,
  },
  speedChip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  crChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  beastCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtn: {
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  adoptBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
