import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";

interface FormattedDescriptionProps {
  content: string;
}

type Block =
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(rawText: string): Block[] {
  if (!rawText) return [];
  const lines = rawText.split("\n");
  const blocks: Block[] = [];
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const p = currentParagraph.join("\n").trim();
      if (p) blocks.push({ type: "paragraph", text: p });
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push({
        type: "table",
        headers: currentTable.headers,
        rows: currentTable.rows,
      });
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if line looks like markdown table row: | a | b | c |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // If it's the separator row | --- | :---: |
      if (cells.length > 0 && cells.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    }

    // Empty line check
    if (trimmed === "") {
      // Lookahead: is next non-empty line a table row?
      let nextIsTable = false;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextTrimmed = lines[j].trim();
        if (nextTrimmed.startsWith("|") && nextTrimmed.endsWith("|")) {
          nextIsTable = true;
          break;
        } else if (nextTrimmed !== "") {
          break;
        }
      }
      if (nextIsTable && currentTable) {
        continue;
      }
      flushTable();
      flushParagraph();
      continue;
    }

    // Headings: ### Title or ## Title
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch && !currentTable) {
      flushParagraph();
      flushTable();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    flushTable();
    currentParagraph.push(rawLine);
  }

  flushTable();
  flushParagraph();
  return blocks;
}

/** Renders bold segments (**text**) within paragraph */
function renderInlineFormattedText(text: string, baseColor: string, accentColor: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldContent = part.slice(2, -2);
      return (
        <Text key={index} style={{ fontWeight: "700", color: baseColor }}>
          {boldContent}
        </Text>
      );
    }
    return (
      <Text key={index} style={{ color: baseColor }}>
        {part}
      </Text>
    );
  });
}

export const FormattedDescription: React.FC<FormattedDescriptionProps> = ({ content }) => {
  const { theme } = useAppTheme();
  const blocks = React.useMemo(() => parseMarkdownBlocks(content), [content]);

  if (!content) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <Text
              key={idx}
              style={[
                styles.heading,
                {
                  color: theme.text,
                  fontSize: block.level === 1 ? 16 : block.level === 2 ? 15 : 14,
                },
              ]}
            >
              {block.text}
            </Text>
          );
        }

        if (block.type === "paragraph") {
          return (
            <Text key={idx} style={[styles.paragraph, { color: theme.textSecondary }]}>
              {renderInlineFormattedText(block.text, theme.text, theme.accent)}
            </Text>
          );
        }

        if (block.type === "table") {
          return (
            <View key={idx} style={styles.tableWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View
                  style={[
                    styles.tableContainer,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  {/* Table Header */}
                  {block.headers.length > 0 && (
                    <View
                      style={[
                        styles.tableRow,
                        styles.tableHeaderRow,
                        {
                          backgroundColor: theme.surfaceHighlight,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      {block.headers.map((h, hIdx) => (
                        <View key={hIdx} style={[styles.tableCell, { borderRightColor: theme.borderLight }]}>
                          <Text style={[styles.tableHeaderText, { color: theme.accent }]}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Table Rows */}
                  {block.rows.map((row, rIdx) => {
                    const isEven = rIdx % 2 === 0;
                    return (
                      <View
                        key={rIdx}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: isEven ? theme.surface : theme.surfaceHighlight,
                            borderBottomColor: rIdx === block.rows.length - 1 ? "transparent" : theme.borderLight,
                          },
                        ]}
                      >
                        {row.map((cell, cIdx) => (
                          <View key={cIdx} style={[styles.tableCell, { borderRightColor: theme.borderLight }]}>
                            <Text style={[styles.tableCellText, { color: theme.text }]}>{cell}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  heading: {
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 2,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
  },
  tableWrapper: {
    marginVertical: 6,
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    borderBottomWidth: 1.5,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 80,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableCellText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
