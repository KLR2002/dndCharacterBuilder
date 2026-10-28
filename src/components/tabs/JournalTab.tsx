import React, { useMemo, useState } from "react";
import {
  Image,
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCharacters } from "../../context/CharacterContext";
import { useAppTheme } from "../../context/ThemeContext";
import { findRace } from "../../services/dataService";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const ALIGNMENT_OPTIONS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
  "Unaligned",
];

interface LoreSection {
  title: string;
  content: string;
}

function parseLoreSections(text: string): LoreSection[] {
  const parts = text.split(/(?=###?\s+)/);
  const sections: LoreSection[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^###?\s+([^\n]+)\n*([\s\S]*)$/);
    if (match) {
      const title = match[1].trim();
      const content = match[2].trim();
      if (content) {
        sections.push({ title, content });
      }
    } else {
      sections.push({ title: "Overview", content: trimmed });
    }
  }
  return sections;
}

export const JournalTab: React.FC = () => {
  const { currentCharacter, updateCharacter, activeBooks } = useCharacters();
  const { theme } = useAppTheme();

  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [loreExpanded, setLoreExpanded] = useState(false);

  // Find auto-populated race info
  const raceData = currentCharacter?.race ? findRace(currentCharacter.race, activeBooks) : null;

  const raceLore = useMemo(() => {
    if (!raceData) return null;
    return `${raceData.description || ""}\n\n${(raceData.traits || []).map((t) => `### ${t.name}\n\n${t.description}`).join("\n\n")}`.trim();
  }, [raceData]);

  const loreSections: LoreSection[] = useMemo(() => (raceLore ? parseLoreSections(raceLore) : []), [raceLore]);

  if (!currentCharacter) return null;

  // Pick Image via expo-image-picker
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        updateCharacter(currentCharacter.id, { avatarUri: result.assets[0].uri });
      }
    } catch (e) {
      console.warn("Failed to pick image:", e);
    }
  };

  const setAvatarFromUrl = () => {
    if (avatarUrlInput.trim()) {
      updateCharacter(currentCharacter.id, { avatarUri: avatarUrlInput.trim() });
      setAvatarUrlInput("");
      setUrlModalVisible(false);
    }
  };

  const removeAvatar = () => {
    updateCharacter(currentCharacter.id, { avatarUri: null });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Portrait & Identity Card */}
      <Card style={styles.portraitCard}>
        <View style={styles.avatarRow}>
          {/* Avatar Image */}
          <TouchableOpacity
            disabled={!currentCharacter.avatarUri}
            activeOpacity={0.8}
            onPress={() => setFullscreenImageVisible(true)}
            style={[styles.avatarBox, { borderColor: theme.accent, backgroundColor: theme.surfaceHighlight }]}
          >
            {currentCharacter.avatarUri ? (
              <Image source={{ uri: currentCharacter.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={54} color={theme.textMuted} />
            )}
          </TouchableOpacity>

          <View style={{ flex: 1, gap: 6 }}>
            <View>
              <Text style={styles.fieldLabel}>Character Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.surfaceHighlight,
                    borderColor: theme.border,
                    fontSize: 16,
                    fontWeight: "700",
                  },
                ]}
                value={currentCharacter.name}
                onChangeText={(t) => updateCharacter(currentCharacter.id, { name: t })}
                placeholder="Character Name"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Button
                title="Upload Art"
                icon="image"
                size="sm"
                variant="primary"
                onPress={pickImage}
              />
              <Button
                title="Enter URL"
                icon="link"
                size="sm"
                variant="outline"
                onPress={() => setUrlModalVisible(true)}
              />
              {currentCharacter.avatarUri && (
                <Button
                  title="Remove"
                  icon="trash"
                  size="sm"
                  variant="danger"
                  onPress={removeAvatar}
                />
              )}
            </View>
          </View>
        </View>

        {/* Identity Inputs (Gender & Alignment) */}
        <View style={styles.identityInputsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={currentCharacter.gender}
              onChangeText={(t) => updateCharacter(currentCharacter.id, { gender: t })}
              placeholder="e.g. Female / Male / Non-binary"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Alignment</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={currentCharacter.alignment}
              onChangeText={(t) => updateCharacter(currentCharacter.id, { alignment: t })}
              placeholder="e.g. Chaotic Good"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Alignment Quick Pick Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {ALIGNMENT_OPTIONS.map((al) => (
            <TouchableOpacity
              key={al}
              onPress={() => updateCharacter(currentCharacter.id, { alignment: al })}
              style={[
                styles.alignmentPill,
                {
                  backgroundColor: currentCharacter.alignment === al ? theme.accent : theme.surfaceHighlight,
                },
              ]}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{al}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Card>

      {/* Faction Card */}
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Ionicons name="flag-outline" size={18} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>FACTION & ALLEGIANCES</Text>
        </View>

        <View style={{ gap: 8 }}>
          <View>
            <Text style={styles.fieldLabel}>Faction Name</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={currentCharacter.faction?.name || ""}
              onChangeText={(t) =>
                updateCharacter(currentCharacter.id, {
                  faction: { ...(currentCharacter.faction || { name: "", rank: "", renown: "", notes: "" }), name: t },
                })
              }
              placeholder="e.g. Harpers, Lords' Alliance, Zhentarim..."
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Rank / Title</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                value={currentCharacter.faction?.rank || ""}
                onChangeText={(t) =>
                  updateCharacter(currentCharacter.id, {
                    faction: { ...(currentCharacter.faction || { name: "", rank: "", renown: "", notes: "" }), rank: t },
                  })
                }
                placeholder="Watcher"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Renown</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
                value={currentCharacter.faction?.renown || ""}
                onChangeText={(t) =>
                  updateCharacter(currentCharacter.id, {
                    faction: { ...(currentCharacter.faction || { name: "", rank: "", renown: "", notes: "" }), renown: t },
                  })
                }
                placeholder="3"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Faction Notes / Standing</Text>
            <TextInput
              style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={currentCharacter.faction?.notes || ""}
              onChangeText={(t) =>
                updateCharacter(currentCharacter.id, {
                  faction: { ...(currentCharacter.faction || { name: "", rank: "", renown: "", notes: "" }), notes: t },
                })
              }
              multiline
              numberOfLines={2}
              placeholder="Missions completed, key faction contacts..."
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>
      </Card>

      {/* Auto-Populated Race Lore & Biology */}
      {raceLore && (
        <Card style={{ marginBottom: 16, borderColor: theme.borderLight, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="book-outline" size={18} color={theme.accent} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {currentCharacter.race?.name} Lore & Biology
              </Text>
            </View>
            {loreSections.length > 3 && (
              <TouchableOpacity onPress={() => setLoreExpanded((prev) => !prev)}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>
                  {loreExpanded ? "Collapse" : "Expand All"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {loreSections.slice(0, loreExpanded ? undefined : 3).map((sec, idx) => (
            <View
              key={`${sec.title}_${idx}`}
              style={{
                backgroundColor: theme.surfaceHighlight,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: theme.border,
                gap: 4,
              }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={
                    sec.title.toLowerCase().includes("age")
                      ? "hourglass-outline"
                      : sec.title.toLowerCase().includes("size")
                        ? "body-outline"
                        : sec.title.toLowerCase().includes("align")
                          ? "compass-outline"
                          : sec.title.toLowerCase().includes("lang")
                            ? "chatbubble-ellipses-outline"
                            : "information-circle-outline"
                  }
                  size={14}
                  color={theme.accent}
                />
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
                  {sec.title}
                </Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                {sec.content.replace(/\*\*/g, "").replace(/###?\s+/g, "")}
              </Text>
            </View>
          ))}
          {!loreExpanded && loreSections.length > 3 && (
            <TouchableOpacity
              onPress={() => setLoreExpanded(true)}
              style={{ alignSelf: "center", paddingVertical: 4 }}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "600" }}>
                + {loreSections.length - 3} more sections...
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      )}

      {/* Personality & Traits */}
      <Card style={{ marginBottom: 16, gap: 10 }}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>PERSONALITY & CHARACTERISTICS</Text>

        <View>
          <Text style={styles.fieldLabel}>Personality Traits</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={currentCharacter.personalityTraits || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { personalityTraits: t })}
            multiline
            numberOfLines={3}
            placeholder="I always have a joke ready..."
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Ideals</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={currentCharacter.ideals || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { ideals: t })}
            multiline
            numberOfLines={2}
            placeholder="Freedom: Chains are meant to be broken..."
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Bonds</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={currentCharacter.bonds || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { bonds: t })}
            multiline
            numberOfLines={2}
            placeholder="I will do anything to protect the temple..."
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Flaws</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={currentCharacter.flaws || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { flaws: t })}
            multiline
            numberOfLines={2}
            placeholder="I can't resist a risky gamble..."
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </Card>

      {/* Backstory & Appearance */}
      <Card style={{ marginBottom: 16, gap: 10 }}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>PHYSICAL DESCRIPTION & BACKSTORY</Text>

        <View>
          <Text style={styles.fieldLabel}>Physical Appearance & Mannerisms</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            value={currentCharacter.description || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { description: t })}
            multiline
            numberOfLines={3}
            placeholder="Age, height, eye color, clothing, distinguishing marks..."
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Backstory</Text>
          <TextInput
            style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border, minHeight: 100 }]}
            value={currentCharacter.backstory || ""}
            onChangeText={(t) => updateCharacter(currentCharacter.id, { backstory: t })}
            multiline
            numberOfLines={6}
            placeholder="Where did your character grow up? Why did they take up adventuring?..."
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </Card>

      {/* General Adventure Notes */}
      <Card style={{ marginBottom: 16, gap: 8 }}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>ADVENTURE & CAMPAIGN NOTES</Text>
        <TextInput
          style={[styles.textArea, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border, minHeight: 120 }]}
          value={currentCharacter.notes || ""}
          onChangeText={(t) => updateCharacter(currentCharacter.id, { notes: t })}
          multiline
          numberOfLines={8}
          placeholder="NPC names, session recaps, loot to sell, quests..."
          placeholderTextColor={theme.textMuted}
        />
      </Card>

      {/* URL Image Modal */}
      <RNModal visible={urlModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>
              Enter Character Art URL
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              value={avatarUrlInput}
              onChangeText={setAvatarUrlInput}
              placeholder="https://example.com/portrait.jpg"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => setUrlModalVisible(false)} />
              <Button title="Save Art" variant="primary" size="sm" onPress={setAvatarFromUrl} />
            </View>
          </Card>
        </View>
      </RNModal>

      {/* Fullscreen Character Art Preview Modal */}
      <RNModal
        visible={fullscreenImageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageVisible(false)}
      >
        <View style={styles.fullscreenModalOverlay}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenImageVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
          >
            <Ionicons name="close-circle" size={40} color="#ffffff" />
          </TouchableOpacity>
          {currentCharacter.avatarUri && (
            <Image
              source={{ uri: currentCharacter.avatarUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
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
  portraitCard: {
    padding: 14,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatarBox: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  characterNameTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  characterSubtitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  identityInputsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 4,
  },
  input: {
    height: 40,
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
    minHeight: 50,
  },
  alignmentPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: 16,
  },
  fullscreenModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  fullscreenCloseBtn: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 20,
  },
  fullscreenImage: {
    width: "100%",
    height: "85%",
  },
});
