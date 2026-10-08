# Subagent Model Tiering

How to allocate model tiers when invoking subagents to conserve tokens and prevent quota exhaustion.

## Tier Allocation Matrix

- **`flash`**: Use for research subagents conducting codebase searches, file reading, AST surveying, documentation lookups, and grep legwork.
- **`pro` / `inherit`**: Reserve for implementation subagents, complex multi-file refactoring, architectural synthesis, and two-axis review aggregation.

## Guidelines

- Never launch broad whole-repo exploration on `pro` tier.
- Keep exploration prompts focused and bounded: pass exact file lists and target diff filters rather than open-ended scans.
