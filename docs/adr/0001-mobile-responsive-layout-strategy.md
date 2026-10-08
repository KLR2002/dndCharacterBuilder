# 0001 Mobile Responsive Layout Strategy

## Context
The character builder and sheet are used across mobile devices ranging from compact 320px screens (iPhone SE 1st gen, small Android phones, foldable cover screens) to standard phones (360–430px) and tablets/desktop web (≥768px). Previously, fixed horizontal row layouts and unconstrained modal containers led to cut-off buttons and cramped stats on smaller devices.

## Decision
We establish:
1. **Minimum Width Guarantee**: 320px minimum viewport width where all controls, modals, and sheets remain fully usable with zero horizontal clipping.
2. **Standard Responsive Hook (`useResponsiveLayout`)**: A centralized hook wrapping `useWindowDimensions()` and `useSafeAreaInsets()` to provide consistent breakpoints:
   - `compact`: `< 380px`
   - `mobile`: `< 600px`
   - `tablet`: `≥ 768px`
3. **Card-Based Mobile Actions**: Dense combat data (weapons, attacks, items) uses card-based components with minimum 44×44pt tap targets rather than multi-column fixed tables.
4. **Unified Modal Shell**: All modals use the shared `<Modal>` component with `flexShrink: 1` scroll containers, responsive button footers, and safe area insets.
