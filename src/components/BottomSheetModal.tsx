import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKlavesnica } from "../hooks/useKlavesnica";
import { colors, font, spacing } from "../theme";
import { prekrytieKlavesnicou } from "../utils/klavesnica";
import { SheetNadKlavesnicouContext } from "./FormScrollView";

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
  const backdropRef = useRef<View>(null);
  const klavesnicaY = useKlavesnica();
  const [prekrytie, setPrekrytie] = useState(0);

  const zmeraj = useCallback(() => {
    if (!visible || klavesnicaY === null) {
      setPrekrytie(0);
      return;
    }
    backdropRef.current?.measureInWindow((_x, y, _w, h) =>
      setPrekrytie(prekrytieKlavesnicou(y, h, klavesnicaY)),
    );
  }, [visible, klavesnicaY]);

  useEffect(() => {
    zmeraj();
  }, [zmeraj]);

  // Pri otvorenej klávesnici sheet sedí tesne nad ňou a zmenší sa, ak sa nezmestí.
  const nadKlavesnicou: ViewStyle | null =
    prekrytie > 0
      ? { marginBottom: prekrytie + spacing.sm, minHeight: 0, flexShrink: 1 }
      : null;

  const sheetStyle: ViewStyle = {
    ...(tall ? styles.sheetTall : styles.sheet),
    marginBottom: bottomLift,
    paddingBottom: spacing.md,
    ...nadKlavesnicou,
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        ref={backdropRef}
        collapsable={false}
        onLayout={zmeraj}
        style={[styles.backdrop, { paddingTop: insets.top }]}
      >
        <Pressable
          style={styles.backdropTap}
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <View style={sheetStyle}>
          <Text style={styles.title}>{title}</Text>
          <SheetNadKlavesnicouContext.Provider value>
            {children}
          </SheetNadKlavesnicouContext.Provider>
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
