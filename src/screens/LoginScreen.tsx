import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { cs } from "../i18n/cs";
import { colors, spacing } from "../theme";

export function LoginScreen() {
  const { signIn, redirectUri } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{cs.nazov}</Text>
        <Text style={styles.subtitle}>{cs.prihlaseni.podtitulek}</Text>

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onLogin}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>{cs.prihlaseni.prihlasit}</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.redirectBox}>
          <Text style={styles.redirectLabel}>{cs.prihlaseni.redirectUri}</Text>
          <Text selectable style={styles.redirectValue}>
            {redirectUri}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    color: colors.muted,
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  button: {
    backgroundColor: colors.primary,
    minHeight: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 16,
    lineHeight: 22,
  },
  redirectBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  redirectLabel: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "600",
  },
  redirectValue: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});