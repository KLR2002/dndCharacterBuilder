import React, { useState } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCharacters } from "../context/CharacterContext";
import { useAppTheme } from "../context/ThemeContext";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SyncProgressModal } from "./SyncProgressModal";

export function BeastsNotice() {
  const { theme } = useAppTheme();
  const { lacksBeasts, downloadBeasts } = useCharacters();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState({ category: "Beasts", step: 1, total: 1 });
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!lacksBeasts) return null;

  const startDownload = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncStep({ category: "Beasts", step: 1, total: 1 });
    try {
      await downloadBeasts((category, step, total) => {
        setSyncStep({ category, step, total });
      });
      setIsSyncing(false);
    } catch (err: any) {
      setSyncError(err?.message || "Failed to download beasts");
    }
  };

  return (
    <>
      <Card
        style={{
          padding: 10,
          marginTop: 8,
          backgroundColor: theme.warning + "15",
          borderColor: theme.warning + "60",
          borderWidth: 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          {/* The text's basis lets the button wrap onto its own line before the text is squeezed. */}
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="warning-outline" size={18} color={theme.warning} />
            <Text style={{ color: theme.text, fontSize: 12, flex: 1, flexShrink: 1, minWidth: 0 }}>
              Beasts were not downloaded. Wild Shape shows only the SRD beasts.
            </Text>
          </View>
          <Button title="Download beasts" size="sm" variant="outline" onPress={startDownload} />
        </View>
      </Card>
      <SyncProgressModal
        visible={isSyncing}
        title="Downloading beasts"
        errorTitle="Download failed"
        category={syncStep.category}
        step={syncStep.step}
        total={syncStep.total}
        error={syncError}
        onClose={() => {
          setIsSyncing(false);
          setSyncError(null);
        }}
      />
    </>
  );
}
