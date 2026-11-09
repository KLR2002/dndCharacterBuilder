import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DiceOverlay } from "../components/dice/DiceOverlay";
import { CharacterProvider } from "../context/CharacterContext";
import { RollLogProvider } from "../context/RollLogContext";
import { ThemeProvider } from "../context/ThemeContext";
import { SerifFontProvider } from "../hooks/useSerifFont";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SerifFontProvider>
        <CharacterProvider>
          <RollLogProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a0c" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="character/[id]" />
              <Stack.Screen name="build/[id]" />
              <Stack.Screen name="options" />
            </Stack>
            <DiceOverlay />
          </RollLogProvider>
        </CharacterProvider>
      </SerifFontProvider>
    </ThemeProvider>
  );
}
