import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { colors, font, spacing } from "../theme";

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.7;

type Props = {
  fotky: string[];
  onChange: (fotky: string[]) => void;
  max?: number;
  disabled?: boolean;
};

/** Zmenší fotku na dlhšiu stranu 1280 px a uloží ako JPEG 0.7. */
async function zmensitFotku(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  try {
    const longer = Math.max(asset.width || 0, asset.height || 0);
    if (longer > MAX_SIDE) {
      if ((asset.width || 0) >= (asset.height || 0)) {
        ctx.resize({ width: MAX_SIDE, height: null });
      } else {
        ctx.resize({ width: null, height: MAX_SIDE });
      }
    }
    const image = await ctx.renderAsync();
    try {
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: JPEG_QUALITY,
      });
      return saved.uri;
    } finally {
      image.release();
    }
  } finally {
    ctx.release();
  }
}

export function FotkyPicker({ fotky, onChange, max = 5, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const zostava = max - fotky.length;

  const pridat = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const nove: string[] = [];
    for (const asset of assets.slice(0, zostava)) {
      nove.push(await zmensitFotku(asset));
    }
    onChange([...fotky, ...nove].slice(0, max));
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert(
        "Fotka",
        err instanceof Error ? err.message : "Fotku sa nepodarilo spracovať.",
      );
    } finally {
      setBusy(false);
    }
  };

  const odfotit = () =>
    run(async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Fotoaparát",
          "Bez povolenia fotoaparátu nie je možné fotiť. Povoľte ho v nastaveniach alebo vyberte fotku z galérie.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;
      await pridat(result.assets);
    });

  const zGalerie = () =>
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: zostava,
        quality: 1,
      });
      if (result.canceled) return;
      await pridat(result.assets);
    });

  const odstranit = (uri: string) => onChange(fotky.filter((f) => f !== uri));

  const canAdd = zostava > 0 && !busy && !disabled;

  return (
    <View style={styles.wrap}>
      {fotky.length > 0 ? (
        <View style={styles.grid}>
          {fotky.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              {!disabled ? (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => odstranit(uri)}
                  hitSlop={8}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.btnRow}>
        <Pressable
          style={[styles.btn, !canAdd && styles.btnDisabled]}
          disabled={!canAdd}
          onPress={() => void odfotit()}
        >
          <Text style={styles.btnText}>Odfotiť</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, !canAdd && styles.btnDisabled]}
          disabled={!canAdd}
          onPress={() => void zGalerie()}
        >
          <Text style={styles.btnText}>Z galérie</Text>
        </Pressable>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      <Text style={styles.hint}>
        {fotky.length}/{max} fotiek
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  thumbWrap: { width: 88, height: 88 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "#fff", fontSize: font.sm, fontWeight: "800" },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  hint: { fontSize: font.xs, color: colors.muted },
});
