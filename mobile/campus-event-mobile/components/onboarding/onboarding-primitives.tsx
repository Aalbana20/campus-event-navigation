import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

// ---------- design tokens (forced dark to match web) ----------
// Lifted dark — base sits slightly off pure black so cards/inputs read with
// depth instead of disappearing.
export const onbColors = {
  bg: '#0b0b0d',
  bgElevated: '#111113',
  bgElevated2: '#141416',
  bgInput: '#111113',
  border: '#2a2a2e',
  borderStrong: '#3a3a3f',
  text: '#ffffff',
  textSecondary: '#9b9ba1',
  textMuted: '#5a5a5f',
  link: '#0a84ff',
  accent: '#0a84ff',
  accentStrong: '#1a8fff',
  success: '#30d158',
  warning: '#ffd60a',
  error: '#ff453a',
};

// ---------- TopBar ----------
// Apple-style circular icon button: subtle translucent fill, soft border,
// scale-on-press. Always rendered top-left so users can recover state
// without restarting the flow.
export function OnbTopBar(props: { onBack?: () => void; onClose?: () => void; variant?: 'back' | 'close' }) {
  const { onBack, onClose, variant = 'back' } = props;
  const onPress = variant === 'close' ? onClose : onBack;
  const glyph = variant === 'close' ? '✕' : '‹';
  return (
    <View style={topBarStyles.bar}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          hitSlop={12}
          accessibilityLabel={variant === 'close' ? 'Close' : 'Back'}
          style={({ pressed }) => [
            topBarStyles.icon,
            pressed ? topBarStyles.iconPressed : null,
          ]}
        >
          <Text style={topBarStyles.glyph}>{glyph}</Text>
        </Pressable>
      ) : (
        <View style={topBarStyles.icon} />
      )}
    </View>
  );
}
const topBarStyles = StyleSheet.create({
  bar: { height: 56, paddingHorizontal: 16, justifyContent: 'center' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  glyph: { color: onbColors.text, fontSize: 24, lineHeight: 26, fontWeight: '300', includeFontPadding: false },
});

// ---------- Progress ----------
export function OnbProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={progressStyles.track}>
      <View style={[progressStyles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}
const progressStyles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: onbColors.text, borderRadius: 999 },
});

// ---------- Buttons ----------
type BtnProps = PressableProps & { children: React.ReactNode };

export function OnbPrimaryButton({ children, disabled, ...rest }: BtnProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        btnStyles.base,
        btnStyles.primary,
        disabled ? btnStyles.disabled : null,
        pressed && !disabled ? btnStyles.primaryPressed : null,
      ]}
    >
      <Text style={btnStyles.primaryLabel}>{children}</Text>
    </Pressable>
  );
}
export function OnbGhostButton({ children, disabled, ...rest }: BtnProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        btnStyles.base,
        btnStyles.ghost,
        disabled ? btnStyles.disabled : null,
        pressed && !disabled ? btnStyles.ghostPressed : null,
      ]}
    >
      <Text style={btnStyles.ghostLabel}>{children}</Text>
    </Pressable>
  );
}
const btnStyles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: onbColors.accent,
    shadowColor: onbColors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: onbColors.accentStrong,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  ghostPressed: { backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ scale: 0.98 }] },
  primaryLabel: { color: '#fff', fontWeight: '600', fontSize: 17, letterSpacing: -0.2 },
  ghostLabel: { color: onbColors.text, fontWeight: '600', fontSize: 17 },
});

// ---------- Floating-label input ----------
export function OnbInput(
  props: TextInputProps & {
    label: string;
    state?: 'success' | 'error' | null;
    helper?: string;
    helperState?: 'success' | 'error' | null;
    rightSlot?: React.ReactNode;
  },
) {
  const { label, state, helper, helperState, rightSlot, value, onFocus, onBlur, style, ...rest } = props;
  const [focused, setFocused] = useState(false);
  const filled = !!value;
  const floating = focused || filled;
  const borderColor =
    state === 'error'
      ? onbColors.error
      : state === 'success'
        ? onbColors.success
        : focused
          ? onbColors.text
          : onbColors.border;
  return (
    <View style={inputStyles.field}>
      <View style={[inputStyles.wrap, { borderColor }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              inputStyles.label,
              floating ? inputStyles.labelFloating : null,
            ]}
          >
            {label}
          </Text>
          <TextInput
            {...rest}
            value={value}
            placeholderTextColor={onbColors.textMuted}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[inputStyles.input, style as TextStyle]}
          />
        </View>
        {rightSlot ? <View style={inputStyles.suffix}>{rightSlot}</View> : null}
      </View>
      {helper ? (
        <Text
          style={[
            inputStyles.helper,
            helperState === 'error' ? { color: onbColors.error } : null,
            helperState === 'success' ? { color: onbColors.success } : null,
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
const inputStyles = StyleSheet.create({
  field: { width: '100%', marginBottom: 12 },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: onbColors.bgInput,
  },
  label: {
    color: onbColors.textSecondary,
    fontSize: 15,
    position: 'absolute',
    left: 0,
    top: 22,
  } as TextStyle,
  labelFloating: {
    fontSize: 12,
    fontWeight: '500',
    top: 6,
  } as TextStyle,
  input: {
    color: onbColors.text,
    fontSize: 17,
    paddingTop: 22,
    paddingBottom: 4,
    height: 64,
  },
  suffix: { marginLeft: 8 },
  helper: { color: onbColors.textSecondary, fontSize: 13, marginTop: 8, paddingLeft: 4 },
});

// ---------- Status ring ----------
export function OnbStatusRing({ status }: { status: 'idle' | 'checking' | 'available' | 'success' | 'taken' | 'error' | 'invalid' }) {
  if (status === 'checking') {
    return (
      <View style={[ringStyles.ring]}>
        <ActivityIndicator size="small" color={onbColors.text} />
      </View>
    );
  }
  if (status === 'available' || status === 'success') {
    return (
      <View style={[ringStyles.ring, ringStyles.ok]}>
        <Text style={ringStyles.glyph}>✓</Text>
      </View>
    );
  }
  if (status === 'taken' || status === 'error' || status === 'invalid') {
    return (
      <View style={[ringStyles.ring, ringStyles.bad]}>
        <Text style={ringStyles.glyph}>!</Text>
      </View>
    );
  }
  return null;
}
const ringStyles = StyleSheet.create({
  ring: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: onbColors.success },
  bad: { backgroundColor: onbColors.error },
  glyph: { color: '#000', fontWeight: '900', fontSize: 12 },
});

// ---------- Chip ----------
export function OnbChip({ active, onPress, label }: { active?: boolean; onPress?: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.base,
        active ? chipStyles.active : null,
        pressed ? chipStyles.pressed : null,
      ]}
    >
      <Text style={[chipStyles.label, active ? chipStyles.activeLabel : null]}>{label}</Text>
    </Pressable>
  );
}
const chipStyles = StyleSheet.create({
  base: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: onbColors.bgElevated,
    borderWidth: 1,
    borderColor: onbColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: '#fff', borderColor: '#fff' },
  pressed: { opacity: 0.85 },
  label: { color: onbColors.text, fontSize: 14, fontWeight: '500' } as TextStyle,
  activeLabel: { color: '#000' } as TextStyle,
});

// ---------- Title / Subtitle ----------
export function OnbTitle({ children }: { children: React.ReactNode }) {
  return <Text style={titleStyles.title}>{children}</Text>;
}
export function OnbSubtitle({ children }: { children: React.ReactNode }) {
  return <Text style={titleStyles.subtitle}>{children}</Text>;
}
const titleStyles = StyleSheet.create({
  title: {
    color: onbColors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    color: onbColors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 32,
  },
});

// ---------- Banner ----------
export function OnbBanner({ children, tone = 'error' }: { children?: React.ReactNode; tone?: 'error' | 'success' }) {
  if (!children) return null;
  return (
    <View
      style={[
        bannerStyles.base,
        tone === 'error' ? bannerStyles.error : bannerStyles.success,
      ]}
    >
      <Text style={[bannerStyles.label, tone === 'error' ? { color: onbColors.error } : { color: onbColors.success }]}>
        {children}
      </Text>
    </View>
  );
}
const bannerStyles = StyleSheet.create({
  base: { borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1 },
  error: { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: 'rgba(255,69,58,0.4)' },
  success: { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: 'rgba(48,209,88,0.4)' },
  label: { fontSize: 13, lineHeight: 18 },
});

// ---------- Layout helpers ----------
export const onbLayout = StyleSheet.create({
  root: { flex: 1, backgroundColor: onbColors.bg },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  spacer: { flex: 1 } as ViewStyle,
  actions: { gap: 12, paddingTop: 24 },
  centerHero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  binary: { flexDirection: 'row', gap: 16, paddingVertical: 24 },
  binaryTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: onbColors.bgElevated,
    borderWidth: 1,
    borderColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  binaryTileActive: { backgroundColor: onbColors.accent, borderColor: onbColors.accent },
  binaryTileLabel: { color: onbColors.text, fontSize: 22, fontWeight: '600' },
  card: {
    backgroundColor: onbColors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1c1c1e',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardActive: { borderColor: onbColors.text, borderWidth: 1.5 },
  cardTitle: { color: onbColors.text, fontWeight: '600', fontSize: 17, marginBottom: 4 },
  cardDesc: { color: onbColors.textSecondary, fontSize: 14, lineHeight: 18 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
});
