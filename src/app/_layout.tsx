import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CharacterProvider } from "../context/CharacterContext";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CharacterProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a0c" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="character/[id]" />
          <Stack.Screen name="options" />
        </Stack>
      </CharacterProvider>
    </ThemeProvider>
  );
}
