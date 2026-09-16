import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, spacing } from "../theme";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Väčší sheet (zoznam zakázok) */
  tall?: boolean;
  /** Zatvorenie klikom na pozadie */
  dismissOnBackdrop?: boolean;
};

export function BottomSheetModal({
  visible,
  title,
  onClose,
  children,
  tall = false,
  dismissOnBackdrop = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomLift = insets.bottom + spacing.lg;

  const sheetStyle: ViewStyle = tall
    ? {
        ...styles.sheetTall,
        marginBottom: bottomLift,
        paddingBottom: spacing.md,
      }
    : {
        ...styles.sheet,
        marginBottom: bottomLift,
        paddingBottom: spacing.md,
      };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTap}
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <View style={sheetStyle}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
    maxHeight: "62%",
  },
  sheetTall: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    maxHeight: "78%",
    minHeight: "55%",
  },
  title: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
});
