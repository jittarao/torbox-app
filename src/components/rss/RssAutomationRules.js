'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRssFeeds } from '@/components/shared/hooks/useRssFeeds';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import ConfirmButton from '@/components/shared/ConfirmButton';
import Toast from '@/components/shared/Toast';

export default function RssAutomationRules({ apiKey, setToast }) {
  const t = useTranslations('RssAutomation');
  const { feeds } = useRssFeeds(apiKey);
  
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    feed_id: '',
    enabled: true,
    title_pattern: '',
    category_pattern: '',
    size_min: '',
    size_max: '',
    age_hours: 24,
    download_type: 'auto',
    seed_time: 1,
    priority: 'normal',
    notification: false
  });

  // Fetch automation rules
  const fetchRules = useCallback(async () => {
    if (!apiKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/rss/automation', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch automation rules');
      }

      const data = await response.json();
      
      if (data.success) {
        setRules(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch automation rules');
      }
    } catch (err) {
      console.error('Error fetching automation rules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  // Add or modify automation rule
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.feed_id) {
      setToast({
        message: t('validation.nameAndFeedRequired'),
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = editingRule ? '/api/rss/automation' : '/api/rss/automation';
      const method = editingRule ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          ...formData,
          ...(editingRule && { id: editingRule.id }),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: editingRule ? t('editSuccess') : t('addSuccess'),
          type: 'success',
        });
        setShowAddForm(false);
        setEditingRule(null);
        resetForm();
        await fetchRules();
      } else {
        setToast({
          message: data.error || t('saveError'),
          type: 'error',
        });
      }
    } catch (error) {
      setToast({
        message: error.message || t('saveError'),
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete automation rule
  const handleDelete = async (ruleId) => {
    try {
      const response = await fetch(`/api/rss/automation/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: t('deleteSuccess'),
          type: 'success',
        });
        await fetchRules();
      } else {
        setToast({
          message: data.error || t('deleteError'),
          type: 'error',
        });
      }
    } catch (error) {
      setToast({
        message: error.message || t('deleteError'),
        type: 'error',
      });
    }
  };

  // Toggle rule enabled state
  const handleToggleRule = async (ruleId, enabled) => {
    try {
      const response = await fetch('/api/rss/automation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          id: ruleId,
          enabled: !enabled,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setToast({
          message: enabled ? t('disableSuccess') : t('enableSuccess'),
          type: 'success',
        });
        await fetchRules();
      } else {
        setToast({
          message: data.error || t('toggleError'),
          type: 'error',
        });
      }
    } catch (error) {
      setToast({
        message: error.message || t('toggleError'),
        type: 'error',
      });
    }
  };

  // Edit rule
  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || '',
      feed_id: rule.feed_id || '',
      enabled: rule.enabled !== false,
      title_pattern: rule.title_pattern || '',
      category_pattern: rule.category_pattern || '',
      size_min: rule.size_min || '',
      size_max: rule.size_max || '',
      age_hours: rule.age_hours || 24,
      download_type: rule.download_type || 'auto',
      seed_time: rule.seed_time || 1,
      priority: rule.priority || 'normal',
      notification: rule.notification || false
    });
    setShowAddForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      feed_id: '',
      enabled: true,
      title_pattern: '',
      category_pattern: '',
      size_min: '',
      size_max: '',
      age_hours: 24,
      download_type: 'auto',
      seed_time: 1,
      priority: 'normal',
      notification: false
    });
  };

  // Cancel form
  const handleCancel = () => {
    setShowAddForm(false);
    setEditingRule(null);
    resetForm();
  };

  // Get rule status
  const getRuleStatus = (rule) => {
    if (!rule.enabled) return 'disabled';
    if (rule.last_run) {
      const lastRun = new Date(rule.last_run);
      const now = new Date();
      const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 1) return 'recent';
      if (hoursSinceLastRun < 24) return 'active';
      return 'stale';
    }
    return 'new';
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'recent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'active': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'stale': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'disabled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <Icons.ExclamationTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{t('error')}</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <Icons.Plus className="w-4 h-4" />
          {t('addRule')}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-surface-alt dark:bg-surface-alt-dark p-6 rounded-lg border border-border dark:border-border-dark">
          <h3 className="text-lg font-medium mb-4 text-primary-text dark:text-primary-text-dark">
            {editingRule ? t('editRule') : t('addRule')}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('ruleName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('ruleNamePlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('feed')}
                </label>
                <select
                  value={formData.feed_id}
                  onChange={(e) => setFormData({ ...formData, feed_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                >
                  <option value="">{t('selectFeed')}</option>
                  {feeds.map((feed) => (
                    <option key={feed.id} value={feed.id}>
                      {feed.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Patterns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('titlePattern')}
                </label>
                <input
                  type="text"
                  value={formData.title_pattern}
                  onChange={(e) => setFormData({ ...formData, title_pattern: e.target.value })}
                  placeholder={t('titlePatternPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 mt-1">
                  {t('titlePatternHelp')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('categoryPattern')}
                </label>
                <input
                  type="text"
                  value={formData.category_pattern}
                  onChange={(e) => setFormData({ ...formData, category_pattern: e.target.value })}
                  placeholder={t('categoryPatternPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Size and Age Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('minSize')} (GB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.size_min}
                  onChange={(e) => setFormData({ ...formData, size_min: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('maxSize')} (GB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.size_max}
                  onChange={(e) => setFormData({ ...formData, size_max: e.target.value })}
                  placeholder="∞"
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('maxAge')} (hours)
                </label>
                <input
                  type="number"
                  value={formData.age_hours}
                  onChange={(e) => setFormData({ ...formData, age_hours: parseInt(e.target.value) || 24 })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Download Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('downloadType')}
                </label>
                <select
                  value={formData.download_type}
                  onChange={(e) => setFormData({ ...formData, download_type: e.target.value })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="auto">{t('auto')}</option>
                  <option value="queued">{t('queued')}</option>
                  <option value="manual">{t('manual')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('seedTime')} (hours)
                </label>
                <input
                  type="number"
                  value={formData.seed_time}
                  onChange={(e) => setFormData({ ...formData, seed_time: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('priority')}
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="low">{t('low')}</option>
                  <option value="normal">{t('normal')}</option>
                  <option value="high">{t('high')}</option>
                </select>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-primary-text dark:text-primary-text-dark">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded border-border dark:border-border-dark text-accent focus:ring-accent"
                />
                {t('enabled')}
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-primary-text dark:text-primary-text-dark">
                <input
                  type="checkbox"
                  checked={formData.notification}
                  onChange={(e) => setFormData({ ...formData, notification: e.target.checked })}
                  className="rounded border-border dark:border-border-dark text-accent focus:ring-accent"
                />
                {t('sendNotification')}
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Spinner size="sm" /> : <Icons.Check className="w-4 h-4" />}
                {t('save')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <Icons.Automation className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('noRules')}</p>
          </div>
        ) : (
          rules.map((rule) => {
            const status = getRuleStatus(rule);
            const feed = feeds.find(f => f.id === rule.feed_id);
            
            return (
              <div
                key={rule.id}
                className="bg-surface dark:bg-surface-dark p-4 rounded-lg border border-border dark:border-border-dark"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-primary-text dark:text-primary-text-dark">
                        {rule.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)}`}>
                        {t(`status.${status}`)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mb-2">
                      {t('feed')}: {feed?.name || t('unknownFeed')}
                    </p>
                    
                    <div className="flex gap-4 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                      {rule.title_pattern && (
                        <span>{t('titlePattern')}: {rule.title_pattern}</span>
                      )}
                      {rule.category_pattern && (
                        <span>{t('categoryPattern')}: {rule.category_pattern}</span>
                      )}
                      {rule.last_run && (
                        <span>{t('lastRun')}: {new Date(rule.last_run).toLocaleString()}</span>
                      )}
                      {rule.downloads_count > 0 && (
                        <span>{t('downloads')}: {rule.downloads_count}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleRule(rule.id, rule.enabled)}
                      className={`px-3 py-1 text-xs rounded ${
                        rule.enabled
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                      } transition-colors`}
                    >
                      {rule.enabled ? t('disable') : t('enable')}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      <Icons.Edit className="w-3 h-3" />
                    </button>
                    <ConfirmButton
                      onClick={() => handleDelete(rule.id)}
                      confirmIcon={<Icons.Check className="w-3 h-3" />}
                      defaultIcon={<Icons.Delete className="w-3 h-3" />}
                      className="px-3 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                      title={t('confirmDelete.title')}
                      message={t('confirmDelete.message')}
                      confirmText={t('confirmDelete.confirm')}
                      cancelText={t('confirmDelete.cancel')}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
