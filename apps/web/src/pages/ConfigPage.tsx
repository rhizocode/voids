import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Tab, TabList, TabPanel, Tabs } from '../components/ui';
import { TmdbTab } from './config/TmdbTab';
import { ServersTab } from './config/ServersTab';
import { ScheduleTab } from './config/ScheduleTab';
import { NotificationsTab } from './config/NotificationsTab';
import { RadarrTab } from './config/RadarrTab';
import { NetworkTab } from './config/NetworkTab';
import { AdvancedTab } from './config/AdvancedTab';

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
          <Tab value="radarr">Radarr</Tab>
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
          <NotificationsTab />
        </TabPanel>
        <TabPanel value="radarr">
          <RadarrTab />
        </TabPanel>
        <TabPanel value="network">
          <NetworkTab />
        </TabPanel>
        <TabPanel value="advanced">
          <AdvancedTab />
        </TabPanel>
      </Tabs>
    </div>
  );
}
