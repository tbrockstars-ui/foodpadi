import React, { useState } from 'react';
import { AuthScreen } from '../screens/AuthScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';

type View = 'auth' | 'forgot' | 'reset';

/**
 * Same state-driven-switch approach as RootNavigator (see its file comment):
 * these three screens form one linear, pre-authentication flow with no
 * meaningful "back stack" beyond "return to login", so a full navigation
 * stack would be more machinery than the flow needs.
 */
export function AuthFlow() {
  const [view, setView] = useState<View>('auth');
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  if (view === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBackToLogin={() => {
          setSuccessMessage(undefined);
          setView('auth');
        }}
        onHaveResetCode={() => setView('reset')}
      />
    );
  }

  if (view === 'reset') {
    return (
      <ResetPasswordScreen
        onBackToLogin={() => setView('auth')}
        onResetComplete={() => {
          setSuccessMessage('Your password has been reset. Log in with your new password.');
          setView('auth');
        }}
      />
    );
  }

  return <AuthScreen onForgotPassword={() => setView('forgot')} successMessage={successMessage} />;
}
