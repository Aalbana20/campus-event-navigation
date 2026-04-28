import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OnbProgress,
  OnbTopBar,
  onbColors,
  onbLayout,
} from '@/components/onboarding/onboarding-primitives';
import {
  OnboardingData,
  StepAccountType,
  StepAvatar,
  StepEntry,
  StepInterests,
  StepNameBirth,
  StepOrgCategories,
  StepOrgInfo,
  StepOrgName,
  StepOtp,
  StepPassword,
  StepPhone,
  StepSchool,
  StepSubmitting,
  StepTerms,
  StepUsername,
  initialOnboardingData,
} from '@/components/onboarding/onboarding-steps';
import { US_SCHOOLS } from '@/lib/signup-data';
import { useMobileApp } from '@/providers/mobile-app-provider';

type Stage = 'entry' | 'flow' | 'submitting' | 'done';

// Personal: account-type → username → phone → otp → password → name+birth →
// avatar → interests → terms → school (optional, with required .edu verify
// if a school is selected). signUp fires at the end.
const INDIVIDUAL_FLOW = [
  'account-type', 'username', 'phone', 'otp', 'password',
  'name-birth', 'avatar', 'interests', 'terms', 'school',
] as const;

// Business: account-type → org-name → username → phone → otp → password →
// org-info (type + recovery email) → logo → categories → terms.
const ORG_FLOW = [
  'account-type', 'org-name', 'username', 'phone', 'otp', 'password',
  'org-info', 'org-logo', 'org-categories', 'terms',
] as const;

type StepKey = (typeof INDIVIDUAL_FLOW | typeof ORG_FLOW)[number];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useMobileApp();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('entry');
  const [stepKey, setStepKey] = useState<StepKey>('account-type');
  const [data, setData] = useState<OnboardingData>(initialOnboardingData);
  const [error, setError] = useState('');

  const update = (patch: Partial<OnboardingData>) =>
    setData((curr) => ({ ...curr, ...patch }));

  const flow = useMemo<readonly StepKey[]>(() => {
    if (data.accountType === 'organization') return ORG_FLOW;
    return INDIVIDUAL_FLOW;
  }, [data.accountType]);

  const stepIndex = flow.indexOf(stepKey);
  const progress = stage === 'flow' ? (stepIndex + 1) / flow.length : 0;

  const goNext = () => {
    const idx = flow.indexOf(stepKey);
    if (idx < 0) return;
    if (idx >= flow.length - 1) {
      void submit();
      return;
    }
    setStepKey(flow[idx + 1]);
  };
  const goBack = () => {
    const idx = flow.indexOf(stepKey);
    if (idx <= 0) {
      setStage('entry');
      return;
    }
    setStepKey(flow[idx - 1]);
  };
  const onClose = () => router.replace('/auth/sign-in');

  const submit = async () => {
    setStage('submitting');
    setError('');
    try {
      const isOrg = data.accountType === 'organization';
      const selectedSchool = US_SCHOOLS.find((s) => s.id === data.schoolId);
      const accountType: 'student' | 'organization' | 'regular' = isOrg
        ? 'organization'
        : selectedSchool && data.schoolVerified
          ? 'student'
          : 'regular';

      // Resolve auth email: verified .edu > org email > synthesized fallback.
      const eduEmail = data.eduEmail.trim().toLowerCase();
      const orgEmail = data.orgEmail.trim().toLowerCase();
      const phoneDigits = data.phone.replace(/\D/g, '');
      const usernameLower = data.username.trim().toLowerCase();
      const fallbackHandle = usernameLower || phoneDigits || `user${Date.now()}`;
      const cleanEmail = isOrg
        ? orgEmail || `${fallbackHandle}@signup.campusevent.app`
        : accountType === 'student'
          ? eduEmail
          : `${fallbackHandle}@signup.campusevent.app`;

      const result = await signUp({
        accountType,
        firstName: isOrg ? '' : data.firstName.trim(),
        lastName: isOrg ? '' : data.lastName.trim(),
        fullName: isOrg
          ? data.orgName.trim()
          : [data.firstName.trim(), data.lastName.trim()].filter(Boolean).join(' '),
        username:
          usernameLower || (isOrg ? data.orgName.trim().toLowerCase().replace(/\s+/g, '') : ''),
        email: cleanEmail,
        password: data.password,
        phoneNumber: data.phone,
        birthMonth: isOrg ? undefined : data.birthMonth,
        birthDay: isOrg ? undefined : data.birthDay,
        birthYear: isOrg ? undefined : data.birthYear,
        gender: '',
        school: accountType === 'student' ? selectedSchool?.label || '' : undefined,
        schoolId: accountType === 'student' ? selectedSchool?.id || '' : undefined,
        schoolEmail: accountType === 'student' ? eduEmail : undefined,
        collegeStatus: isOrg ? null : accountType === 'student' ? 'in_college' : 'not_in_college',
        organizationName: isOrg ? data.orgName.trim() : undefined,
        organizationType: isOrg ? data.orgType : undefined,
        organizationDescription: isOrg
          ? `Official updates from ${data.orgName.trim()}.`
          : undefined,
        interests: isOrg ? [] : data.interests,
        categories: isOrg ? data.orgCategories : [],
      });

      if (!result.ok) throw new Error(result.error || 'Unable to create your account right now.');

      if (result.requiresEmailConfirmation) {
        router.replace({
          pathname: '/auth/sign-in',
          params: {
            notice: 'Account created. Check your email and then sign in.',
          },
        });
        return;
      }

      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed.');
      setStage('submitting');
    }
  };

  // ---------------- Render ----------------
  let body: React.ReactNode = null;
  let topVariant: 'back' | 'close' = 'back';
  let onTopAction: (() => void) | undefined = goBack;
  let showProgress = stage === 'flow';

  if (stage === 'entry') {
    topVariant = 'close';
    onTopAction = onClose;
    showProgress = false;
    body = (
      <StepEntry
        onCreate={() => {
          setStage('flow');
          setStepKey('account-type');
        }}
        onLogin={onClose}
      />
    );
  } else if (stage === 'submitting') {
    showProgress = false;
    onTopAction = () => setStage('flow');
    body = <StepSubmitting error={error} onRetry={() => void submit()} />;
  } else if (stage === 'flow') {
    switch (stepKey) {
      case 'account-type':
        body = <StepAccountType data={data} update={update} goNext={goNext} />;
        break;
      case 'username':
        body = <StepUsername data={data} update={update} goNext={goNext} />;
        break;
      case 'phone':
        body = <StepPhone data={data} update={update} goNext={goNext} />;
        break;
      case 'otp':
        body = <StepOtp data={data} update={update} goNext={goNext} goBack={goBack} />;
        break;
      case 'password':
        body = <StepPassword data={data} update={update} goNext={goNext} />;
        break;
      case 'name-birth':
        body = <StepNameBirth data={data} update={update} goNext={goNext} />;
        break;
      case 'avatar':
        body = <StepAvatar data={data} update={update} goNext={goNext} />;
        break;
      case 'interests':
        body = <StepInterests data={data} update={update} goNext={goNext} />;
        break;
      case 'terms':
        body = <StepTerms goNext={goNext} goBack={goBack} />;
        break;
      case 'school':
        body = (
          <StepSchool
            data={data}
            update={update}
            onFinish={() => void submit()}
            onSkip={() => void submit()}
          />
        );
        break;
      case 'org-name':
        body = <StepOrgName data={data} update={update} goNext={goNext} />;
        break;
      case 'org-info':
        body = <StepOrgInfo data={data} update={update} goNext={goNext} />;
        break;
      case 'org-logo':
        body = <StepAvatar data={data} update={update} goNext={goNext} isOrg />;
        break;
      case 'org-categories':
        body = <StepOrgCategories data={data} update={update} goNext={goNext} />;
        break;
    }
  }

  // Push the top bar below the status bar / dynamic island so the back button
  // isn't covered by system chrome (which would silently swallow taps and
  // make the button feel "non-functional"). Add a small extra gap so the
  // circle doesn't sit flush against the inset edge.
  const topPadding = insets.top + 8;
  const bottomPadding = insets.bottom + 8;

  return (
    <View style={[styles.root, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <StatusBar barStyle="light-content" />
      <OnbTopBar variant={topVariant} onBack={onTopAction} onClose={onClose} />
      {showProgress ? <OnbProgress value={progress} /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[onbLayout.body, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onbColors.bg },
});
