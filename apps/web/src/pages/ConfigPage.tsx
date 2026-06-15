import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card, Tab, TabList, TabPanel, Tabs } from '../components/ui';
import { TmdbTab } from './config/TmdbTab';
import { ServersTab } from './config/ServersTab';
import { ScheduleTab } from './config/ScheduleTab';

function LaterPhasePanel() {
  return (
    <Card className="text-sm text-slate-400">Configured in a later phase.</Card>
  );
}

export function ConfigPage() {
  const [tab, setTab] = useState('tmdb');

  return (
    <div>
      <PageHeader title="Configuration" subtitle="Set up TMDB and your media servers." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabList>
          <Tab value="tmdb">TMDB</Tab>
          <Tab value="servers">Media Servers</Tab>
          <Tab value="schedule">Schedule</Tab>
          <Tab value="notifications">Notifications</Tab>
          <Tab value="network">Network</Tab>
          <Tab value="advanced">Advanced</Tab>
        </TabList>

        <TabPanel value="tmdb">
          <TmdbTab />
        </TabPanel>
        <TabPanel value="servers">
          <ServersTab />
        </TabPanel>
        <TabPanel value="schedule">
          <ScheduleTab />
        </TabPanel>
        <TabPanel value="notifications">
          <LaterPhasePanel />
        </TabPanel>
        <TabPanel value="network">
          <LaterPhasePanel />
        </TabPanel>
        <TabPanel value="advanced">
          <LaterPhasePanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}
