import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import {
  BIRTH_MONTHS,
  INTEREST_OPTIONS,
  ORGANIZATION_TYPES,
  US_SCHOOLS,
  formatPhoneNumber,
  getBirthDayOptions,
  getBirthYearOptions,
  getDaysInMonth,
  getPasswordChecks,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  sanitizePhoneNumber,
} from '@/lib/signup-data';

import {
  OnbBanner,
  OnbChip,
  OnbGhostButton,
  OnbInput,
  OnbPrimaryButton,
  OnbStatusRing,
  OnbSubtitle,
  OnbTitle,
  onbColors,
  onbLayout,
} from './onboarding-primitives';

export type OnboardingData = {
  accountType: 'individual' | 'organization' | null;
  inCollege: boolean | null;
  schoolId: string;
  schoolLabel: string;
  schoolVerified: boolean;
  eduEmail: string;
  username: string;
  birthMonth: string;
  birthDay: string;
  birthYear: string;
  phone: string;
  phoneVerified: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  avatarUri: string;
  interests: string[];
  interestDescription: string;
  firstName: string;
  lastName: string;
  // org
  orgName: string;
  orgType: string;
  orgEmail: string;
  orgCategories: string[];
};

export const initialOnboardingData: OnboardingData = {
  accountType: null,
  inCollege: null,
  schoolId: '',
  schoolLabel: '',
  schoolVerified: false,
  eduEmail: '',
  username: '',
  birthMonth: '',
  birthDay: '',
  birthYear: '',
  phone: '',
  phoneVerified: false,
  email: '',
  password: '',
  confirmPassword: '',
  avatarUri: '',
  interests: [],
  interestDescription: '',
  firstName: '',
  lastName: '',
  orgName: '',
  orgType: '',
  orgEmail: '',
  orgCategories: [],
};

type StepProps = {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  goNext: () => void;
  goBack?: () => void;
};

/* -------------------- Step 0: Entry -------------------- */
export function StepEntry({ onCreate, onLogin }: { onCreate: () => void; onLogin: () => void }) {
  return (
    <>
      <View style={onbLayout.centerHero}>
        <View style={entryStyles.mark}>
          <Text style={entryStyles.markText}>CE</Text>
        </View>
        <OnbTitle>Find your people. Find your night.</OnbTitle>
        <Text style={entryStyles.tagline}>
          Discover events on and off campus, RSVP with friends, and don't miss the moment.
        </Text>
      </View>
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={onCreate}>Create Account</OnbPrimaryButton>
        <OnbGhostButton onPress={onLogin}>I already have one</OnbGhostButton>
      </View>
    </>
  );
}
const entryStyles = StyleSheet.create({
  mark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: onbColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  markText: { color: '#fff', fontWeight: '700', fontSize: 24 },
  tagline: { color: onbColors.textSecondary, fontSize: 16, textAlign: 'center', maxWidth: 320, lineHeight: 22 },
});

/* -------------------- Step 1: Account type --------------------
   accountType values stay 'individual' / 'organization' internally so
   they keep mapping cleanly to the existing trigger and SignUpInput
   contract. Only the user-facing copy changes (Personal / Business). */
export function StepAccountType({ data, update, goNext }: StepProps) {
  const select = (type: 'individual' | 'organization') => {
    update({ accountType: type });
    setTimeout(goNext, 220);
  };
  return (
    <>
      <OnbTitle>How will you use the app?</OnbTitle>
      <OnbSubtitle>Pick one. You can add the other later.</OnbSubtitle>
      <View style={{ gap: 12 }}>
        <Pressable
          onPress={() => select('individual')}
          style={[onbLayout.card, data.accountType === 'individual' ? onbLayout.cardActive : null]}
        >
          <View style={{ flex: 1 }}>
            <Text style={onbLayout.cardTitle}>Personal</Text>
            <Text style={onbLayout.cardDesc}>Discover events, RSVP, message friends</Text>
          </View>
          <Text style={{ color: onbColors.textMuted, fontSize: 22 }}>›</Text>
        </Pressable>
        <View style={accountTypeStyles.divider}>
          <View style={accountTypeStyles.dividerLine} />
          <Text style={accountTypeStyles.dividerLabel}>OR</Text>
          <View style={accountTypeStyles.dividerLine} />
        </View>
        <Pressable
          onPress={() => select('organization')}
          style={[onbLayout.card, data.accountType === 'organization' ? onbLayout.cardActive : null]}
        >
          <View style={{ flex: 1 }}>
            <Text style={onbLayout.cardTitle}>Business</Text>
            <Text style={onbLayout.cardDesc}>Host events, build a following</Text>
          </View>
          <Text style={{ color: onbColors.textMuted, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>
    </>
  );
}
const accountTypeStyles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: onbColors.border },
  dividerLabel: {
    color: onbColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
});

/* -------------------- Step 2: College question -------------------- */
export function StepCollege({ data, update, goNext }: StepProps) {
  const select = (val: boolean) => {
    update({ inCollege: val });
    setTimeout(goNext, 200);
  };
  return (
    <>
      <OnbTitle>Are you in college?</OnbTitle>
      <OnbSubtitle>If so, we'll verify your school — it unlocks campus events.</OnbSubtitle>
      <View style={onbLayout.binary}>
        <Pressable
          onPress={() => select(true)}
          style={[onbLayout.binaryTile, data.inCollege === true ? onbLayout.binaryTileActive : null]}
        >
          <Text style={onbLayout.binaryTileLabel}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => select(false)}
          style={[onbLayout.binaryTile, data.inCollege === false ? onbLayout.binaryTileActive : null]}
        >
          <Text style={onbLayout.binaryTileLabel}>No</Text>
        </Pressable>
      </View>
    </>
  );
}

/* -------------------- Step: School (optional, final) -------------------- */
type SchoolPhase = 'entering' | 'sending' | 'verified';

export function StepSchool({
  data,
  update,
  onFinish,
  onSkip,
}: {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<SchoolPhase>(data.schoolVerified ? 'verified' : 'entering');
  const [error, setError] = useState('');
  const [query, setQuery] = useState(data.schoolLabel);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return US_SCHOOLS.slice(0, 7);
    return US_SCHOOLS.filter((s) =>
      `${s.label} ${(s.domains || []).join(' ')}`.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  const selected = US_SCHOOLS.find((s) => s.id === data.schoolId);
  const expectedDomain = selected?.domains?.[0];
  const emailMatches =
    !!expectedDomain &&
    isValidEmail(data.eduEmail) &&
    data.eduEmail.trim().toLowerCase().endsWith(`@${expectedDomain}`);

  const handleVerify = () => {
    if (!emailMatches) {
      setError(`Use a ${expectedDomain} email to verify your school.`);
      return;
    }
    setError('');
    setPhase('sending');
    // Placeholder: real flow = supabase.auth.signInWithOtp({ email })
    setTimeout(() => {
      update({ schoolVerified: true });
      setPhase('verified');
    }, 1000);
  };

  if (phase === 'verified') {
    return (
      <>
        <View style={onbLayout.centerHero}>
          <View style={verifyStyles.checkRing}>
            <Text style={verifyStyles.checkGlyph}>✓</Text>
          </View>
          <OnbTitle>School verified</OnbTitle>
          <OnbSubtitle>{selected?.label} is now linked to your account.</OnbSubtitle>
        </View>
        <View style={onbLayout.actions}>
          <OnbPrimaryButton onPress={onFinish}>Finish &amp; create account</OnbPrimaryButton>
          <OnbGhostButton
            onPress={() => {
              update({ schoolVerified: false });
              setPhase('entering');
            }}
          >
            Use a different school
          </OnbGhostButton>
        </View>
      </>
    );
  }

  return (
    <>
      <OnbTitle>Add your school</OnbTitle>
      <OnbSubtitle>Stay in the loop with campus events. Optional — skip and you'll still see public ones.</OnbSubtitle>

      <OnbInput
        label="Search your school"
        value={query}
        onChangeText={(t: string) => {
          setQuery(t);
          if (data.schoolId) update({ schoolId: '', schoolLabel: '' });
        }}
        autoCapitalize="words"
      />
      {!data.schoolId && filtered.length > 0 ? (
        <View style={verifyStyles.results}>
          {filtered.map((s) => (
            <Pressable
              key={s.id}
              style={verifyStyles.resultRow}
              onPress={() => {
                update({ schoolId: s.id, schoolLabel: s.label });
                setQuery(s.label);
              }}
            >
              <Text style={verifyStyles.resultLabel}>{s.label}</Text>
              <Text style={verifyStyles.resultMeta}>{s.domains?.[0]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {data.schoolId ? (
        <OnbInput
          label="School email"
          value={data.eduEmail}
          onChangeText={(t: string) => update({ eduEmail: t })}
          autoCapitalize="none"
          keyboardType="email-address"
          helper={expectedDomain ? `Must end with @${expectedDomain}` : undefined}
        />
      ) : null}

      <OnbBanner tone="error">{error}</OnbBanner>

      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={handleVerify} disabled={!data.schoolId || !data.eduEmail || phase === 'sending'}>
          {phase === 'sending' ? 'Sending...' : 'Verify school email'}
        </OnbPrimaryButton>
        <OnbGhostButton onPress={onSkip}>Skip — I'll add it later</OnbGhostButton>
      </View>
    </>
  );
}
const verifyStyles = StyleSheet.create({
  results: {
    marginTop: 4,
    marginBottom: 12,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: onbColors.border,
    borderRadius: 14,
    backgroundColor: onbColors.bgElevated,
  },
  resultRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#1c1c1e' },
  resultLabel: { color: onbColors.text, fontSize: 15, fontWeight: '500' },
  resultMeta: { color: onbColors.textSecondary, fontSize: 13, marginTop: 2 },
  checkRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: onbColors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkGlyph: { color: '#000', fontSize: 24, fontWeight: '900' },
});

/* -------------------- Step 4: Username -------------------- */
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
export function StepUsername({ data, update, goNext }: StepProps) {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const value = data.username;
  const normalized = normalizeUsername(value);
  const valid = isValidUsername(normalized);

  useEffect(() => {
    if (!normalized) {
      setStatus('idle');
      return;
    }
    if (!valid) {
      setStatus('invalid');
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      if (!supabase) return;
      setStatus('checking');
      const { data: row, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .maybeSingle();
      if (!active) return;
      if (error && error.code !== 'PGRST116') {
        setStatus('idle');
        return;
      }
      setStatus(row ? 'taken' : 'available');
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [normalized, valid]);

  const helper =
    status === 'invalid'
      ? '3–20 characters. Letters, numbers, dots, underscores.'
      : status === 'taken'
        ? "That one's gone. Try another."
        : status === 'available'
          ? 'Looks good.'
          : 'You can change this later.';
  const helperState = status === 'taken' || status === 'invalid' ? 'error' : status === 'available' ? 'success' : null;

  return (
    <>
      <OnbTitle>Create a username</OnbTitle>
      <OnbSubtitle>Use our suggestion or add your own. You can change this later.</OnbSubtitle>
      <OnbInput
        label="Username"
        value={value}
        onChangeText={(t: string) => update({ username: normalizeUsername(t) })}
        autoCapitalize="none"
        autoCorrect={false}
        state={status === 'available' ? 'success' : status === 'taken' || status === 'invalid' ? 'error' : null}
        rightSlot={<OnbStatusRing status={status} />}
        helper={helper}
        helperState={helperState as 'success' | 'error' | null}
      />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={status !== 'available'}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}

/* -------------------- Birthday wheel (Month/Day/Year) -------------------- */
const ITEM_H = 44;

function BirthdayWheel({ data, update }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void }) {
  const years = useMemo(() => getBirthYearOptions(), []);
  const days = useMemo(
    () => getBirthDayOptions(data.birthMonth || 5, data.birthYear || 2000),
    [data.birthMonth, data.birthYear],
  );
  const monthIdx = data.birthMonth ? Number(data.birthMonth) - 1 : 4;
  const dayIdx = data.birthDay ? Math.min(Number(data.birthDay) - 1, days.length - 1) : 0;
  const yearIdx = data.birthYear ? years.indexOf(String(data.birthYear)) : 5;
  const dayRef = useRef<ScrollView | null>(null);

  // Clamp day if month/year shrinks the range (Feb 30 → Feb 28).
  useEffect(() => {
    const max = getDaysInMonth(data.birthMonth, data.birthYear);
    if (data.birthDay && Number(data.birthDay) > max) {
      update({ birthDay: String(max) });
      dayRef.current?.scrollTo({ y: (max - 1) * ITEM_H, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.birthMonth, data.birthYear]);

  const onMonthScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(BIRTH_MONTHS.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (String(idx + 1) !== String(data.birthMonth)) update({ birthMonth: String(idx + 1) });
  };
  const onDayScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(days.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (String(idx + 1) !== String(data.birthDay)) update({ birthDay: String(idx + 1) });
  };
  const onYearScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(years.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (years[idx] !== String(data.birthYear)) update({ birthYear: years[idx] });
  };

  const display = `${BIRTH_MONTHS[monthIdx]?.label || ''} ${days[dayIdx] || ''}, ${years[yearIdx] || ''}`;

  return (
    <>
      <View style={birthStyles.display}>
        <Text style={birthStyles.displayLabel}>Birthday</Text>
        <Text style={birthStyles.displayValue}>{display}</Text>
      </View>
      <View style={birthStyles.wheel}>
        <View style={birthStyles.highlight} pointerEvents="none" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 88 }}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onMonthScroll}
          contentOffset={{ x: 0, y: monthIdx * ITEM_H }}
          style={birthStyles.colMonth}
        >
          {BIRTH_MONTHS.map((m, i) => (
            <Text key={m.value} style={[birthStyles.item, i === monthIdx ? birthStyles.itemActive : null]}>
              {m.label}
            </Text>
          ))}
        </ScrollView>
        <ScrollView
          ref={dayRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 88 }}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onDayScroll}
          contentOffset={{ x: 0, y: dayIdx * ITEM_H }}
          style={birthStyles.colDay}
        >
          {days.map((d, i) => (
            <Text key={d} style={[birthStyles.item, i === dayIdx ? birthStyles.itemActive : null]}>
              {d}
            </Text>
          ))}
        </ScrollView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 88 }}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onYearScroll}
          contentOffset={{ x: 0, y: yearIdx * ITEM_H }}
          style={birthStyles.colYear}
        >
          {years.map((y, i) => (
            <Text key={y} style={[birthStyles.item, i === yearIdx ? birthStyles.itemActive : null]}>
              {y}
            </Text>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

/* -------------------- Step: Name + Birthday (combined) -------------------- */
export function StepNameBirth({ data, update, goNext }: StepProps) {
  const ready =
    data.firstName.trim().length > 0 && !!data.birthMonth && !!data.birthDay && !!data.birthYear;
  return (
    <>
      <OnbTitle>Your name &amp; birthday</OnbTitle>
      <OnbSubtitle>So friends can find you. Birthday is hidden from your profile.</OnbSubtitle>
      <OnbInput
        label="First name"
        value={data.firstName}
        onChangeText={(t: string) => update({ firstName: t })}
        autoCapitalize="words"
      />
      <OnbInput
        label="Last name (optional)"
        value={data.lastName}
        onChangeText={(t: string) => update({ lastName: t })}
        autoCapitalize="words"
      />
      <BirthdayWheel data={data} update={update} />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}

/* -------------------- Step (legacy): Birth month + day + year -------------------- */
export function StepBirth({ data, update, goNext }: StepProps) {
  const ready = !!data.birthMonth && !!data.birthDay && !!data.birthYear;
  return (
    <>
      <OnbTitle>When were you born?</OnbTitle>
      <OnbSubtitle>We use this to recommend age-appropriate events. Hidden from your profile.</OnbSubtitle>
      <BirthdayWheel data={data} update={update} />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}
const birthStyles = StyleSheet.create({
  display: {
    height: 80,
    borderWidth: 1,
    borderColor: onbColors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    marginBottom: 24,
  },
  displayLabel: { color: onbColors.textSecondary, fontSize: 12, fontWeight: '500', marginBottom: 4 },
  displayValue: { color: onbColors.text, fontSize: 22, fontWeight: '500' },
  wheel: { flexDirection: 'row', height: 220, gap: 8, position: 'relative' },
  colMonth: { flex: 2 },
  colDay: { flex: 1 },
  colYear: { flex: 1.4 },
  highlight: {
    position: 'absolute',
    top: 88,
    left: 4,
    right: 4,
    height: ITEM_H,
    backgroundColor: onbColors.bgElevated2,
    borderRadius: 12,
    zIndex: 0,
  },
  item: {
    height: ITEM_H,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: onbColors.textMuted,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: ITEM_H,
  } as TextStyle,
  itemActive: { color: onbColors.text, fontSize: 20 } as TextStyle,
});

/* -------------------- Step 6: Phone -------------------- */
export function StepPhone({ data, update, goNext }: StepProps) {
  const digits = sanitizePhoneNumber(data.phone).replace(/\D/g, '');
  const ready = digits.length === 10;
  return (
    <>
      <OnbTitle>Your phone number</OnbTitle>
      <OnbSubtitle>We'll text a code to confirm it's you.</OnbSubtitle>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <View style={phoneStyles.cc}>
          <Text style={{ color: onbColors.text, fontSize: 17, fontWeight: '500' }}>🇺🇸 +1</Text>
        </View>
        <View style={{ flex: 1 }}>
          <OnbInput
            label="Phone"
            value={data.phone}
            onChangeText={(t: string) => update({ phone: formatPhoneNumber(t) })}
            keyboardType="phone-pad"
          />
        </View>
      </View>
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Send code</OnbPrimaryButton>
      </View>
    </>
  );
}
const phoneStyles = StyleSheet.create({
  cc: { width: 92, height: 64, borderWidth: 1, borderColor: onbColors.border, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

/* -------------------- Step 6b: OTP -------------------- */
export function StepOtp({ data, update, goNext, goBack }: StepProps) {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(60);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 1);
    setCode((curr) => {
      const next = [...curr];
      next[i] = d;
      if (next.every((x) => x !== '') && d) {
        // Placeholder verification: any 6-digit code passes.
        update({ phoneVerified: true });
        setTimeout(goNext, 250);
      }
      return next;
    });
    if (d && refs.current[i + 1]) refs.current[i + 1]?.focus();
  };

  return (
    <>
      <OnbTitle>Enter the code</OnbTitle>
      <OnbSubtitle>
        Sent to {data.phone || 'your phone'} ·{' '}
        <Text style={{ color: onbColors.link }} onPress={goBack}>
          Change
        </Text>
      </OnbSubtitle>
      <View style={otpStyles.row}>
        {code.map((c, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={c}
            onChangeText={(t) => setDigit(i, t)}
            keyboardType="number-pad"
            maxLength={1}
            autoFocus={i === 0}
            style={otpStyles.cell}
          />
        ))}
      </View>
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbGhostButton onPress={() => setCooldown(60)} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </OnbGhostButton>
      </View>
    </>
  );
}
const otpStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    backgroundColor: onbColors.bgElevated,
    borderWidth: 1,
    borderColor: onbColors.border,
    borderRadius: 12,
    color: onbColors.text,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});

/* -------------------- Step 7: Email (non-college individual only) -------------------- */
export function StepEmail({ data, update, goNext }: StepProps) {
  const valid = isValidEmail(data.email);
  return (
    <>
      <OnbTitle>Your email</OnbTitle>
      <OnbSubtitle>For account recovery and important updates only.</OnbSubtitle>
      <OnbInput
        label="Email"
        value={data.email}
        onChangeText={(t: string) => update({ email: t })}
        autoCapitalize="none"
        keyboardType="email-address"
        helper={data.email && !valid ? "That doesn't look like a valid email." : undefined}
        helperState={data.email && !valid ? 'error' : null}
      />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!valid}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}

/* -------------------- Step 8: Password -------------------- */
function strengthLevel(pw: string) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  return Math.min(score, 4);
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', onbColors.error, onbColors.warning, onbColors.link, onbColors.success];

export function StepPassword({ data, update, goNext }: StepProps) {
  const [show, setShow] = useState(false);
  const pw = data.password;
  const cf = data.confirmPassword;
  const checks = getPasswordChecks(pw);
  const lvl = strengthLevel(pw);
  const matches = !!pw && pw === cf;
  const ready = checks.length && matches;
  return (
    <>
      <OnbTitle>Create a password</OnbTitle>
      <OnbSubtitle>8+ characters. Mix it up — letters, numbers, symbols.</OnbSubtitle>
      <OnbInput
        label="Password"
        value={pw}
        onChangeText={(t: string) => update({ password: t })}
        secureTextEntry={!show}
        autoCapitalize="none"
        rightSlot={
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
            <Text style={{ color: onbColors.textSecondary, fontSize: 13 }}>{show ? 'Hide' : 'Show'}</Text>
          </Pressable>
        }
      />
      <View style={pwStyles.bar}>
        {[1, 2, 3, 4].map((seg) => (
          <View
            key={seg}
            style={[
              pwStyles.seg,
              { backgroundColor: seg <= lvl ? STRENGTH_COLORS[lvl] : 'rgba(255,255,255,0.06)' },
            ]}
          />
        ))}
      </View>
      <Text style={{ color: onbColors.textSecondary, fontSize: 12, marginBottom: 16 }}>
        {pw ? `${STRENGTH_LABELS[lvl]} password` : 'Type to see strength'}
      </Text>
      <OnbInput
        label="Confirm password"
        value={cf}
        onChangeText={(t: string) => update({ confirmPassword: t })}
        secureTextEntry={!show}
        autoCapitalize="none"
        helper={cf && !matches ? "Passwords don't match." : undefined}
        helperState={cf && !matches ? 'error' : null}
      />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}
const pwStyles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 4, height: 4, marginTop: 8, marginBottom: 4 },
  seg: { flex: 1, borderRadius: 2 },
});

/* -------------------- Step 9: Terms -------------------- */
export function StepTerms({ goNext, goBack }: { goNext: () => void; goBack?: () => void }) {
  return (
    <>
      <View style={onbLayout.centerHero}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: onbColors.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 28 }}>✦</Text>
        </View>
        <OnbTitle>One last thing</OnbTitle>
        <OnbSubtitle>
          By continuing, you agree to our Terms of Service and acknowledge our Privacy Policy.
        </OnbSubtitle>
      </View>
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext}>Agree &amp; continue</OnbPrimaryButton>
        <OnbGhostButton onPress={goBack}>Cancel</OnbGhostButton>
      </View>
    </>
  );
}

/* -------------------- Step 10: Avatar / logo -------------------- */
export function StepAvatar({ data, update, goNext, isOrg = false }: StepProps & { isOrg?: boolean }) {
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      update({ avatarUri: result.assets[0].uri });
    }
  };
  return (
    <>
      <OnbTitle>{isOrg ? 'Add your logo' : 'Add a profile photo'}</OnbTitle>
      <OnbSubtitle>{isOrg ? 'Optional — but it builds trust.' : "Helps friends recognize you. You can skip this."}</OnbSubtitle>
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Pressable
          onPress={pick}
          style={[avatarStyles.circle, isOrg ? avatarStyles.square : null, data.avatarUri ? avatarStyles.has : null]}
        >
          {data.avatarUri ? (
            <Image source={{ uri: data.avatarUri }} style={avatarStyles.image} />
          ) : (
            <Text style={{ color: onbColors.textSecondary, fontSize: 36 }}>📷</Text>
          )}
        </Pressable>
      </View>
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!data.avatarUri}>Continue</OnbPrimaryButton>
        <OnbGhostButton onPress={goNext}>Skip for now</OnbGhostButton>
      </View>
    </>
  );
}
const avatarStyles = StyleSheet.create({
  circle: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed', backgroundColor: onbColors.bgElevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  square: { borderRadius: 24 },
  has: { borderStyle: 'solid', borderColor: onbColors.text },
  image: { width: '100%', height: '100%' },
});

/* -------------------- Step 11: Interests -------------------- */
export function StepInterests({ data, update, goNext }: StepProps) {
  const [mode, setMode] = useState<'tags' | 'describe'>('tags');
  const interests = data.interests;
  const description = data.interestDescription;
  const toggle = (val: string) => {
    const next = interests.includes(val) ? interests.filter((x) => x !== val) : [...interests, val];
    update({ interests: next });
  };
  const ready = mode === 'tags' ? interests.length >= 3 : description.trim().length >= 20;
  return (
    <>
      <OnbTitle>What are you into?</OnbTitle>
      <OnbSubtitle>Pick a few, or describe your vibe. We'll handle the rest.</OnbSubtitle>
      <View style={segStyles.bar}>
        <Pressable
          onPress={() => setMode('tags')}
          style={[segStyles.btn, mode === 'tags' ? segStyles.btnActive : null]}
        >
          <Text style={[segStyles.label, mode === 'tags' ? segStyles.labelActive : null]}>Pick tags</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('describe')}
          style={[segStyles.btn, mode === 'describe' ? segStyles.btnActive : null]}
        >
          <Text style={[segStyles.label, mode === 'describe' ? segStyles.labelActive : null]}>Describe it</Text>
        </Pressable>
      </View>
      {mode === 'tags' ? (
        <>
          <View style={onbLayout.chipGrid}>
            {INTEREST_OPTIONS.map((tag) => (
              <OnbChip key={tag} active={interests.includes(tag)} onPress={() => toggle(tag)} label={interests.includes(tag) ? tag : `+ ${tag}`} />
            ))}
          </View>
          <Text style={{ color: interests.length >= 3 ? onbColors.success : onbColors.textSecondary, fontSize: 13, marginTop: 8 }}>
            {interests.length} of 3 minimum selected
          </Text>
        </>
      ) : (
        <View style={describeStyles.wrap}>
          <TextInput
            value={description}
            onChangeText={(t) => update({ interestDescription: t })}
            placeholder="I'm into late-night dive bars, ambient music, small art galleries…"
            placeholderTextColor={onbColors.textMuted}
            multiline
            style={describeStyles.input}
          />
        </View>
      )}
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Finish</OnbPrimaryButton>
      </View>
    </>
  );
}
const segStyles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: onbColors.bgElevated, borderRadius: 12, padding: 4, marginBottom: 16 },
  btn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  btnActive: { backgroundColor: onbColors.bgElevated2 },
  label: { color: onbColors.textSecondary, fontSize: 14, fontWeight: '500' },
  labelActive: { color: onbColors.text },
});
const describeStyles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: onbColors.border, borderRadius: 14, padding: 16, minHeight: 140 },
  input: { color: onbColors.text, fontSize: 16, lineHeight: 22, minHeight: 120, textAlignVertical: 'top' },
});

/* -------------------- Step 12: Name (final) -------------------- */
export function StepName({ data, update, onFinish }: StepProps & { onFinish: (dest: 'home' | 'edit') => void }) {
  const ready = data.firstName.trim().length > 0;
  return (
    <>
      <OnbTitle>Your name</OnbTitle>
      <OnbSubtitle>Add your name so people know who they're connecting with.</OnbSubtitle>
      <OnbInput
        label="First name"
        value={data.firstName}
        onChangeText={(t: string) => update({ firstName: t })}
        autoCapitalize="words"
      />
      <OnbInput
        label="Last name (optional)"
        value={data.lastName}
        onChangeText={(t: string) => update({ lastName: t })}
        autoCapitalize="words"
      />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={() => onFinish('edit')} disabled={!ready}>Edit profile</OnbPrimaryButton>
        <OnbGhostButton onPress={() => onFinish('home')} disabled={!ready}>Next</OnbGhostButton>
      </View>
    </>
  );
}

/* -------------------- Org steps -------------------- */
export function StepOrgName({ data, update, goNext }: StepProps) {
  const ready = data.orgName.trim().length >= 2;
  return (
    <>
      <OnbTitle>What's your business called?</OnbTitle>
      <OnbSubtitle>This is how people will find and follow you.</OnbSubtitle>
      <OnbInput
        label="Business name"
        value={data.orgName}
        onChangeText={(t: string) => update({ orgName: t })}
        autoCapitalize="words"
      />
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}

/* -------------------- Org Info: type + recovery email (combined) -------------------- */
export function StepOrgInfo({ data, update, goNext }: StepProps) {
  const type = data.orgType || '';
  const email = data.orgEmail || '';
  const emailValid = isValidEmail(email);
  const ready = !!type && emailValid;
  return (
    <>
      <OnbTitle>Tell us about your business</OnbTitle>
      <OnbSubtitle>Pick a category and add an email we can reach you at.</OnbSubtitle>

      <Text style={{ color: onbColors.textSecondary, fontSize: 12, fontWeight: '500', marginTop: 4, marginBottom: 8, letterSpacing: 0.5 }}>
        CATEGORY
      </Text>
      <View style={onbLayout.chipGrid}>
        {ORGANIZATION_TYPES.map((t) => (
          <OnbChip key={t} active={type === t} onPress={() => update({ orgType: t })} label={t} />
        ))}
      </View>

      <View style={{ height: 16 }} />

      <OnbInput
        label="Business email"
        value={email}
        onChangeText={(t: string) => update({ orgEmail: t })}
        autoCapitalize="none"
        keyboardType="email-address"
        helper={email && !emailValid ? "That doesn't look like a valid email." : "We'll use this for sign-in and recovery."}
        helperState={email && !emailValid ? 'error' : null}
      />

      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={!ready}>Next</OnbPrimaryButton>
      </View>
    </>
  );
}

const ORG_CATEGORIES = ['Music', 'Sports', 'Networking', 'Parties', 'Workshops', 'Greek Life', 'Career', 'Food', 'Tech', 'Wellness', 'Arts', 'Religious'];
export function StepOrgCategories({ data, update, goNext }: StepProps) {
  const value = data.orgCategories;
  const toggle = (t: string) => {
    const next = value.includes(t) ? value.filter((x) => x !== t) : [...value, t];
    update({ orgCategories: next });
  };
  return (
    <>
      <OnbTitle>What will you host?</OnbTitle>
      <OnbSubtitle>Pick a few categories to help people find your events.</OnbSubtitle>
      <View style={onbLayout.chipGrid}>
        {ORG_CATEGORIES.map((t) => (
          <OnbChip key={t} active={value.includes(t)} onPress={() => toggle(t)} label={value.includes(t) ? t : `+ ${t}`} />
        ))}
      </View>
      <Text style={{ color: value.length >= 1 ? onbColors.success : onbColors.textSecondary, fontSize: 13, marginTop: 8 }}>
        {value.length} selected · pick at least 1
      </Text>
      <View style={onbLayout.spacer} />
      <View style={onbLayout.actions}>
        <OnbPrimaryButton onPress={goNext} disabled={value.length < 1}>Finish</OnbPrimaryButton>
      </View>
    </>
  );
}

/* -------------------- Submitting / Done -------------------- */
export function StepSubmitting({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return (
    <View style={onbLayout.centerHero}>
      {error ? (
        <>
          <OnbTitle>Something went wrong</OnbTitle>
          <OnbSubtitle>{error}</OnbSubtitle>
          <View style={{ width: '100%', maxWidth: 320 }}>
            <OnbPrimaryButton onPress={onRetry}>Try again</OnbPrimaryButton>
          </View>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={onbColors.text} style={{ marginBottom: 24 }} />
          <OnbTitle>Setting things up…</OnbTitle>
          <OnbSubtitle>Just a moment.</OnbSubtitle>
        </>
      )}
    </View>
  );
}
