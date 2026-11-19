import React from "react";
import { Text, View } from "react-native";
import type { OptionalFeatureOption } from "../../rules/optionalFeatures";
import type { Character } from "../../types/character";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CollapsibleCard } from "../ui/CollapsibleCard";
import { builderStyles as styles } from "./builderStyles";

export interface OptionalFeatureCardProps {
  options: OptionalFeatureOption[];
  replacements: Character["optionalFeatureReplacements"];
  onToggle: (featureName: string) => void;
  onViewDetail: (item: {
    title: string;
    subtitle?: string;
    description?: string;
  }) => void;
  theme: any;
}

/** The optional and replacement class features the held classes offer (Tasha's). Renders nothing when there are none. */
export const OptionalFeatureCard: React.FC<OptionalFeatureCardProps> = ({
  options,
  replacements,
  onToggle,
  onViewDetail,
  theme,
}) => {
  if (options.length === 0) return null;
  return (
    <CollapsibleCard
      title="Optional & Replacement Class Features:"
      subtitle="Tasha's Cauldron optional features and replacements for your classes."
    >
      <View style={{ gap: 8 }}>
        {options.map((opt) => {
          const isEnabled = Boolean(replacements?.[opt.name]);
          return (
            <View
              key={`${opt.className}_${opt.name}`}
              style={[
                styles.classRow,
                {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: isEnabled ? theme.accentHover : theme.border,
                  gap: 8,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {opt.name}
                  </Text>
                  <Badge
                    label={`Lvl ${opt.level}`}
                    size="sm"
                    variant="surface"
                  />
                  <Badge label={opt.className} size="sm" variant="muted" />
                </View>
                {opt.replacesFeatureName ? (
                  <Text
                    style={{
                      color: theme.warning,
                      fontSize: 11,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Replaces: {opt.replacesFeatureName}
                  </Text>
                ) : (
                  <Text
                    style={{
                      color: theme.accentHover,
                      fontSize: 11,
                      marginTop: 2,
                      fontWeight: "600",
                    }}
                  >
                    Additional Feature
                  </Text>
                )}
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                  numberOfLines={2}
                >
                  {opt.description}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Button
                  title="Info"
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    onViewDetail({
                      title: opt.name,
                      subtitle: `${opt.className} Lvl ${opt.level} • ${
                        opt.replacesFeatureName
                          ? `Replaces ${opt.replacesFeatureName}`
                          : "Additional Feature"
                      }`,
                      description: opt.description,
                    })
                  }
                />
                <Button
                  title={isEnabled ? "Enabled" : "Enable"}
                  variant={isEnabled ? "primary" : "outline"}
                  size="sm"
                  onPress={() => onToggle(opt.name)}
                />
              </View>
            </View>
          );
        })}
      </View>
    </CollapsibleCard>
  );
};
