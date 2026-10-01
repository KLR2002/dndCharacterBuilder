import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

const ALIGNMENTS = [
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

interface NewCharacterModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (characterId: string) => void;
  initialFolderId?: string | null;
}

export const NewCharacterModal: React.FC<NewCharacterModalProps> = ({
  visible,
  onClose,
  onCreated,
  initialFolderId,
}) => {
  const { theme } = useAppTheme();
  const { createCharacter, folders } = useCharacters();

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [alignment, setAlignment] = useState("");
  const [factionName, setFactionName] = useState("");
  const [factionRank, setFactionRank] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId || null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Character Name is required!");
      return;
    }
    setError(null);

    const char = await createCharacter({
      name: name.trim(),
      gender: gender.trim(),
      alignment: alignment.trim(),
      faction: {
        name: factionName.trim(),
        rank: factionRank.trim(),
        renown: "0",
        notes: "",
      },
      folderId,
    });

    // Reset fields
    setName("");
    setGender("");
    setAlignment("");
    setFactionName("");
    setFactionRank("");
    onCreated(char.id);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Create New Character"
      subtitle="Name your hero to begin your journey."
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Proceed to Builder" onPress={handleCreate} />
        </View>
      }>
      <View style={styles.container}>
        {/* Name Field (Required) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.text }]}>
            Character Name <Text style={{ color: theme.accent }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: error ? theme.danger : theme.border,
                color: theme.text,
              },
            ]}
            placeholder="e.g. Roland of Gilead, Seraphina Starling"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError(null);
            }}
            autoFocus
          />
          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
        </View>

        {/* Gender Field */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Gender (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceHighlight,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="e.g. Female, Male, Non-binary"
            placeholderTextColor={theme.textMuted}
            value={gender}
            onChangeText={setGender}
          />
        </View>

        {/* Alignment Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Alignment (Optional)</Text>
          <View style={styles.alignmentGrid}>
            {ALIGNMENTS.map((al) => {
              const isSelected = alignment === al;
              return (
                <TouchableOpacity
                  key={al}
                  activeOpacity={0.7}
                  onPress={() => setAlignment(isSelected ? "" : al)}
                  style={[
                    styles.alignmentChip,
                    {
                      backgroundColor: isSelected ? theme.accentGlow : theme.surfaceRaised,
                      borderColor: isSelected ? theme.accent : theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.alignmentText,
                      { color: isSelected ? theme.accent : theme.textSecondary },
                    ]}>
                    {al}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Faction Fields */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Faction (Optional)</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 2,
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Faction name (e.g. Harpers)"
              placeholderTextColor={theme.textMuted}
              value={factionName}
              onChangeText={setFactionName}
            />
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Rank"
              placeholderTextColor={theme.textMuted}
              value={factionRank}
              onChangeText={setFactionRank}
            />
          </View>
        </View>

        {/* Folder Selection */}
        {folders.length > 0 ? (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Folder (Optional)</Text>
            <View style={styles.folderRow}>
              <TouchableOpacity
                onPress={() => setFolderId(null)}
                style={[
                  styles.folderChip,
                  {
                    backgroundColor: folderId === null ? theme.accentGlow : theme.surfaceRaised,
                    borderColor: folderId === null ? theme.accent : theme.border,
                  },
                ]}>
                <Text style={{ color: folderId === null ? theme.accent : theme.textSecondary, fontSize: 13 }}>
                  No Folder
                </Text>
              </TouchableOpacity>
              {folders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setFolderId(f.id)}
                  style={[
                    styles.folderChip,
                    {
                      backgroundColor: folderId === f.id ? theme.accentGlow : theme.surfaceRaised,
                      borderColor: folderId === f.id ? theme.accent : theme.border,
                    },
                  ]}>
                  <Text style={{ color: folderId === f.id ? theme.accent : theme.textSecondary, fontSize: 13 }}>
                    📁 {f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  alignmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  alignmentChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  alignmentText: {
    fontSize: 12,
    fontWeight: "500",
  },
  folderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  folderChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  footer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
});
