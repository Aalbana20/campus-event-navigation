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

import {
  OnbBanner,
  OnbProgress,
  OnbTopBar,
  onbColors,
  onbLayout,
} from '@/components/onboarding/onboarding-primitives';
import {
  OnboardingData,
  StepAccountType,
  StepAvatar,
  StepBirth,
  StepCollege,
  StepEmail,
  StepEntry,
  StepInterests,
  StepName,
  StepOrgCategories,
  StepOrgName,
  StepOrgType,
  StepOrgVerify,
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

const INDIVIDUAL_COLLEGE = [
  'account-type', 'college', 'school', 'username', 'birth',
  'phone', 'otp', 'password', 'terms', 'avatar', 'interests', 'name',
] as const;
const INDIVIDUAL_NO_COLLEGE = [
  'account-type', 'college', 'username', 'birth',
  'phone', 'otp', 'email', 'password', 'terms', 'avatar', 'interests', 'name',
] as const;
const ORG_FLOW = [
  'account-type', 'org-name', 'org-type', 'org-verify',
  'phone', 'otp', 'password', 'terms', 'org-logo', 'org-categories',
] as const;

type StepKey = (typeof INDIVIDUAL_COLLEGE | typeof INDIVIDUAL_NO_COLLEGE | typeof ORG_FLOW)[number];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useMobileApp();
  const [stage, setStage] = useState<Stage>('entry');
  const [stepKey, setStepKey] = useState<StepKey>('account-type');
  const [data, setData] = useState<OnboardingData>(initialOnboardingData);
  const [error, setError] = useState('');

  const update = (patch: Partial<OnboardingData>) =>
    setData((curr) => ({ ...curr, ...patch }));

  const flow = useMemo<readonly StepKey[]>(() => {
    if (data.accountType === 'organization') return ORG_FLOW;
    if (data.accountType === 'individual' && data.inCollege === false) return INDIVIDUAL_NO_COLLEGE;
    return INDIVIDUAL_COLLEGE;
  }, [data.accountType, data.inCollege]);

  const stepIndex = flow.indexOf(stepKey);
  const progress = stage === 'flow' ? (stepIndex + 1) / flow.length : 0;

  const goNext = () => {
    const idx = flow.indexOf(stepKey);
    if (idx < 0) return;
    if (idx >= flow.length - 1) {
      void submit('home');
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

  const submit = async (destination: 'home' | 'edit') => {
    setStage('submitting');
    setError('');
    try {
      const isOrg = data.accountType === 'organization';
      const cleanEmail = isOrg
        ? data.orgEmail.trim().toLowerCase()
        : data.inCollege
          ? data.eduEmail.trim().toLowerCase()
          : data.email.trim().toLowerCase();

      if (!cleanEmail) throw new Error("We couldn't find a valid email to register your account.");
      if (!data.password || data.password.length < 8) throw new Error('Password is too short.');

      const accountType = isOrg ? 'organization' : data.inCollege ? 'student' : 'regular';
      const selectedSchool = US_SCHOOLS.find((s) => s.id === data.schoolId);

      const result = await signUp({
        accountType,
        firstName: isOrg ? '' : data.firstName.trim(),
        lastName: isOrg ? '' : data.lastName.trim(),
        fullName: isOrg
          ? data.orgName.trim()
          : [data.firstName.trim(), data.lastName.trim()].filter(Boolean).join(' '),
        username: data.username.trim() || (isOrg ? data.orgName.trim().toLowerCase().replace(/\s+/g, '') : ''),
        email: cleanEmail,
        password: data.password,
        phoneNumber: data.phone,
        birthMonth: isOrg ? undefined : data.birthMonth,
        birthYear: isOrg ? undefined : data.birthYear,
        gender: '',
        school: accountType === 'student' ? selectedSchool?.label || '' : undefined,
        schoolId: accountType === 'student' ? selectedSchool?.id || '' : undefined,
        schoolEmail: accountType === 'student' ? cleanEmail : undefined,
        collegeStatus: isOrg ? null : data.inCollege ? 'in_college' : 'not_in_college',
        organizationName: isOrg ? data.orgName.trim() : undefined,
        organizationType: isOrg ? data.orgType : undefined,
        organizationDescription: isOrg ? `Official updates from ${data.orgName.trim()}.` : undefined,
        interests: isOrg ? [] : data.interests,
        categories: isOrg ? data.orgCategories : [],
      });

      if (!result.ok) throw new Error(result.error || 'Unable to create your account right now.');

      if (result.requiresEmailConfirmation) {
        router.replace({
          pathname: '/auth/sign-in',
          params: {
            notice:
              destination === 'edit'
                ? "Account created. Confirm your email, then we'll take you to edit your profile."
                : 'Account created. Check your email and then sign in.',
          },
        });
        return;
      }

      // Logged in immediately. Mobile has no /edit-profile route yet, so the
      // "Edit profile" intent lands on the user's own profile tab where edits
      // are made. Plain "Next" goes to home.
      router.replace(destination === 'edit' ? '/(tabs)/profile' : '/(tabs)/home');
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
    body = <StepSubmitting error={error} onRetry={() => void submit('home')} />;
  } else if (stage === 'flow') {
    const onFinish = (dest: 'home' | 'edit') => void submit(dest);
    switch (stepKey) {
      case 'account-type':
        body = <StepAccountType data={data} update={update} goNext={goNext} />;
        break;
      case 'college':
        body = <StepCollege data={data} update={update} goNext={goNext} />;
        break;
      case 'school':
        body = <StepSchool data={data} update={update} goNext={goNext} />;
        break;
      case 'username':
        body = <StepUsername data={data} update={update} goNext={goNext} />;
        break;
      case 'birth':
        body = <StepBirth data={data} update={update} goNext={goNext} />;
        break;
      case 'phone':
        body = <StepPhone data={data} update={update} goNext={goNext} />;
        break;
      case 'otp':
        body = <StepOtp data={data} update={update} goNext={goNext} goBack={goBack} />;
        break;
      case 'email':
        body = <StepEmail data={data} update={update} goNext={goNext} />;
        break;
      case 'password':
        body = <StepPassword data={data} update={update} goNext={goNext} />;
        break;
      case 'terms':
        body = <StepTerms goNext={goNext} goBack={goBack} />;
        break;
      case 'avatar':
        body = <StepAvatar data={data} update={update} goNext={goNext} />;
        break;
      case 'interests':
        body = <StepInterests data={data} update={update} goNext={goNext} />;
        break;
      case 'name':
        body = <StepName data={data} update={update} goNext={goNext} onFinish={onFinish} />;
        break;
      case 'org-name':
        body = <StepOrgName data={data} update={update} goNext={goNext} />;
        break;
      case 'org-type':
        body = <StepOrgType data={data} update={update} goNext={goNext} />;
        break;
      case 'org-verify':
        body = <StepOrgVerify data={data} update={update} goNext={goNext} />;
        break;
      case 'org-logo':
        body = <StepAvatar data={data} update={update} goNext={goNext} isOrg />;
        break;
      case 'org-categories':
        body = <StepOrgCategories data={data} update={update} goNext={goNext} />;
        break;
    }
  }

  return (
    <View style={styles.root}>
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
