import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { UploadTab } from './components/UploadTab';
import { CalendarTab } from './components/CalendarTab';
import { IntegrationsTab } from './components/IntegrationsTab';
import { PresetsTab } from './components/PresetsTab';
import { SqlSchemaModal } from './components/SqlSchemaModal';
import { Post, Preset, IntegrationStatus, TelegramUser } from './types';
import { initTelegramApp, getTelegramUser } from './lib/telegram';
import { api } from './lib/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [user, setUser] = useState<TelegramUser>(getTelegramUser());
  const [posts, setPosts] = useState<Post[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramApp();
    setUser(getTelegramUser());
  }, []);

  // Fetch all core data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [postsData, presetsData, integrationsData] = await Promise.all([
        api.getPosts().catch(() => []),
        api.getPresets().catch(() => []),
        api.getIntegrations().catch(() => null),
      ]);
      setPosts(postsData);
      setPresets(presetsData);
      if (integrationsData) setIntegrations(integrationsData);
    } catch (err) {
      console.error('Error fetching app data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scheduled posts count for badge
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <Header
        user={user}
        integrations={integrations}
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
      />

      {/* Main Tab Content with smooth transitions */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <UploadTab
                presets={presets}
                onUploadSuccess={fetchData}
                onNavigateToCalendar={() => setActiveTab('calendar')}
              />
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <CalendarTab
                posts={posts}
                isLoading={isLoading}
                onRefresh={fetchData}
                onNavigateToUpload={() => setActiveTab('upload')}
              />
            </motion.div>
          )}

          {activeTab === 'integrations' && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <IntegrationsTab
                user={user}
                integrations={integrations}
                onRefresh={fetchData}
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'presets' && (
            <motion.div
              key="presets"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <PresetsTab
                presets={presets}
                onRefresh={fetchData}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Telegram Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scheduledCount={scheduledCount}
      />

      {/* Supabase SQL Schema Modal */}
      <SqlSchemaModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />
    </div>
  );
}

// rebuild