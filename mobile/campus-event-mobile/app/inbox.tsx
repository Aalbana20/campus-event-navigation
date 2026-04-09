import React from 'react';

import { InboxScreen } from '@/components/mobile/InboxScreen';

export default function InboxRoute() {
  return (
    <InboxScreen
      initialTab="notifications"
      lockedTab="notifications"
      title="Notifications"
      subtitle="Fresh updates from people and events live here."
    />
  );
}
