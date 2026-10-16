import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useKlavesnica } from "../hooks/useKlavesnica";
import { posunNaPole, prekrytieKlavesnicou } from "../utils/klavesnica";

/** true = obsah je v BottomSheetModal, ktorý sa nad klávesnicu dvíha sám. */
export const SheetNadKlavesnicouContext = createContext(false);

type Props = ScrollViewProps & {
  /** Štýl obalu (predvolene flex: 1) */
  obalStyle?: StyleProp<ViewStyle>;
};

function spodnyPadding(style: ScrollViewProps["contentContainerStyle"]): number {
  const s = StyleSheet.flatten(style) ?? {};
  const v = s.paddingBottom ?? s.paddingVertical ?? s.padding ?? 0;
  return typeof v === "number" ? v : 0;
}

/**
 * ScrollView pre formuláre: obsah sa odsadí o prekrytie klávesnicou (Android aj iOS),
 * zaostrené pole sa automaticky posunie nad klávesnicu a tlačidlo Uložiť ostáva
 * dosiahnuteľné posunutím. Ťuknutie na tlačidlá pri otvorenej klávesnici funguje
 * (keyboardShouldPersistTaps="handled").
 */
export const FormScrollView = forwardRef<ScrollView, Props>(function FormScrollView(
  {
    obalStyle,
    contentContainerStyle,
    onScroll,
    onLayout,
    onContentSizeChange,
    onTouchEnd,
    keyboardShouldPersistTaps = "handled",
    scrollEventThrottle = 16,
    children,
    ...rest
  },
  ref,
) {
  const vSheete = useContext(SheetNadKlavesnicouContext);
  const klavesnicaY = useKlavesnica();
  const obalRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const obsahRef = useRef<View>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);

  const offsetRef = useRef(0);
  const vyskaRef = useRef(0);
  const prekrytieRef = useRef(0);
  const zaostreneRef = useRef<unknown>(null);
  const [prekrytie, setPrekrytie] = useState(0);

  const zmeraj = useCallback(() => {
    if (vSheete || klavesnicaY === null) {
      prekrytieRef.current = 0;
      setPrekrytie(0);
      return;
    }
    obalRef.current?.measureInWindow((_x, y, _w, h) => {
      const p = prekrytieKlavesnicou(y, h, klavesnicaY);
      prekrytieRef.current = p;
      setPrekrytie(p);
    });
  }, [klavesnicaY, vSheete]);

  const posunNaZaostrene = useCallback(() => {
    if (klavesnicaY === null) return;
    const input = TextInput.State.currentlyFocusedInput();
    const obsah = obsahRef.current;
    zaostreneRef.current = input ?? null;
    if (!input || !obsah) return;
    input.measureLayout(
      obsah,
      (_x, y, _w, h) => {
        const ciel = posunNaPole({
          poleY: y,
          poleVyska: h,
          offset: offsetRef.current,
          viditelnaVyska: vyskaRef.current - prekrytieRef.current,
        });
        if (ciel !== null) scrollRef.current?.scrollTo({ y: ciel, animated: true });
      },
      () => {
        /* zaostrené pole nie je v tomto formulári */
      },
    );
  }, [klavesnicaY]);

  useEffect(() => {
    zmeraj();
  }, [zmeraj]);

  // Po odsadení obsahu (ďalší render) posuň na zaostrené pole.
  useEffect(() => {
    if (klavesnicaY === null) return;
    const t = setTimeout(posunNaZaostrene, 80);
    return () => clearTimeout(t);
  }, [klavesnicaY, prekrytie, posunNaZaostrene]);

  const paddingBottom = spodnyPadding(contentContainerStyle) + prekrytie;

  return (
    <View
      ref={obalRef}
      style={[styles.obal, obalStyle]}
      collapsable={false}
      onLayout={zmeraj}
    >
      <ScrollView
        ref={scrollRef}
        innerViewRef={obsahRef as React.RefObject<View>}
        {...rest}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
        onLayout={(e) => {
          vyskaRef.current = e.nativeEvent.layout.height;
          onLayout?.(e);
        }}
        onScroll={(e) => {
          offsetRef.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        onContentSizeChange={(w, h) => {
          if (klavesnicaY !== null) posunNaZaostrene();
          onContentSizeChange?.(w, h);
        }}
        onTouchEnd={(e) => {
          // Prepnutie na iné pole pri otvorenej klávesnici (bez novej udalosti klávesnice).
          if (klavesnicaY !== null) {
            setTimeout(() => {
              if (TextInput.State.currentlyFocusedInput() !== zaostreneRef.current) {
                posunNaZaostrene();
              }
            }, 250);
          }
          onTouchEnd?.(e);
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  obal: { flex: 1 },
});
