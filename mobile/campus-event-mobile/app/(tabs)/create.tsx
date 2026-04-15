import { Redirect } from 'expo-router';
import React from 'react';

export default function LegacyCreateRoute() {
  return <Redirect href="/story/create" />;
}
