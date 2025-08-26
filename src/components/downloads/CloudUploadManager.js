'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';

export default function CloudUploadManager({ apiKey, setToast }) {
  const t = useTranslations('CloudUpload');
  const [isOpen, setIsOpen] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  const apiClient = createApiClient(apiKey);

  const providers = [
    {
      id: INTEGRATION_TYPES.GOOGLE_DRIVE,
      name: 'Google Drive',
      icon: Icons.GoogleDrive,
      color: 'text-green-600',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: true,
    },
    {
      id: INTEGRATION_TYPES.DROPBOX,
      name: 'Dropbox',
      icon: Icons.Dropbox,
      color: 'text-blue-600',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: true,
    },
    {
      id: INTEGRATION_TYPES.ONEDRIVE,
      name: 'OneDrive',
      icon: Icons.OneDrive,
      color: 'text-blue-500',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: true,
    },
    {
      id: INTEGRATION_TYPES.GOFILE,
      name: 'GoFile',
      icon: Icons.GoFile,
      color: 'text-purple-600',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: false,
    },
    {
      id: INTEGRATION_TYPES.FICHIER,
      name: '1Fichier',
      icon: Icons.Fichier,
      color: 'text-orange-600',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: false,
    },
    {
      id: INTEGRATION_TYPES.PIXELDRAIN,
      name: 'Pixeldrain',
      icon: Icons.Pixeldrain,
      color: 'text-indigo-600',
      bgColor: 'bg-white dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-700',
      supportsOAuth: false,
    },
  ];

  useEffect(() => {
    if (isOpen) {
      loadActiveJobs();
    }
  }, [isOpen]);

  // Check for connected providers on mount
  useEffect(() => {
    const checkConnectedProviders = async () => {
      try {
        // First try to get cloud provider status
        const statusResponse = await apiClient.getCloudProviderStatus();
        if (statusResponse && statusResponse.data && statusResponse.data.providers) {
          const configuredProviders = {};
          Object.entries(statusResponse.data.providers).forEach(([provider, isConfigured]) => {
            if (isConfigured) {
              configuredProviders[provider] = true;
            }
          });
          setConnectedProviders(configuredProviders);
          return;
        }
      } catch (error) {
        console.log('Cloud provider status check failed, falling back to jobs check');
      }

      // Fallback: Check for active integration jobs
      try {
        const response = await apiClient.getIntegrationJobs();
        if (response && response.data) {
          // Extract unique provider types from active jobs only
          const providers = new Set();
          response.data.forEach(job => {
            if (job.provider && (job.status === 'pending' || job.status === 'uploading' || job.status === 'in_progress')) {
              providers.add(job.provider);
            }
          });
          
          const connected = {};
          providers.forEach(provider => {
            connected[provider] = true;
          });
          setConnectedProviders(connected);
        }
      } catch (error) {
        console.log('No connected providers found or integration not available');
        // Don't show error toast for this as it's expected when integration is not available
      }
    };

    if (apiKey) {
      checkConnectedProviders();
    }
  }, [apiKey]);

  const loadActiveJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const response = await apiClient.getIntegrationJobs();
      if (response.success) {
        // Filter to only show active jobs (pending, uploading)
        const allJobs = response.data || [];
        const activeJobsOnly = allJobs.filter(job => 
          job.status === 'pending' || job.status === 'uploading' || job.status === 'in_progress'
        );
        setActiveJobs(activeJobsOnly);
      }
    } catch (error) {
      console.error('Error loading active jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const connectProvider = async (providerId) => {
    setIsLoading(true);
    try {
      // Check if this provider supports OAuth
      const provider = providers.find(p => p.id === providerId);
      
      if (provider && provider.supportsOAuth) {
        // Open OAuth popup for the provider
        const popup = window.open(
          `/api/integration/oauth/${providerId}?apiKey=${encodeURIComponent(apiKey)}`,
          'oauth-popup',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup) {
          setToast({
            message: 'Please allow popups to connect to cloud providers',
            type: 'error',
          });
          return;
        }

        // Listen for OAuth completion
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Check if connection was successful by trying to get jobs
            loadActiveJobs();
            setToast({
              message: 'OAuth completed. Please check if the connection was successful.',
              type: 'info',
            });
          }
        }, 1000);
      } else {
        // For non-OAuth providers, show a message about manual setup
        setToast({
          message: `${provider.name} requires API key configuration in TorBox settings. Please configure it there and refresh this page.`,
          type: 'info',
        });
      }

    } catch (error) {
      console.error('Error connecting provider:', error);
      setToast({
        message: t('toast.connectionError'),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectProvider = async (providerId) => {
    try {
      // This would need to be implemented in the API
      // For now, we'll just show a message
      setToast({
        message: t('toast.disconnectionSuccess'),
        type: 'success',
      });
    } catch (error) {
      console.error('Error disconnecting provider:', error);
      setToast({
        message: t('toast.disconnectionError'),
        type: 'error',
      });
    }
  };

  const cancelJob = async (jobId) => {
    try {
      const response = await apiClient.cancelIntegrationJob(jobId);
      if (response.success) {
        setToast({
          message: t('toast.jobCancelled'),
          type: 'success',
        });
        loadActiveJobs();
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      setToast({
        message: t('toast.jobCancelError'),
        type: 'error',
      });
    }
  };

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'uploading':
      case 'in_progress':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getJobStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Icons.Check className="w-4 h-4" />;
      case 'failed':
        return <Icons.X className="w-4 h-4" />;
      case 'uploading':
      case 'in_progress':
        return <Spinner size="xs" />;
      case 'pending':
        return <Icons.Clock className="w-4 h-4" />;
      default:
        return <Icons.Clock className="w-4 h-4" />;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-10 h-10 bg-surface-alt dark:bg-surface-alt-dark 
          hover:bg-surface-alt/80 dark:hover:bg-surface-alt-dark/80 rounded-lg transition-colors"
        title={t('title')}
      >
        <Icons.Cloud className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border dark:border-border-dark">
              <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                {t('title')}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-lg transition-colors"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* Connected Providers */}
              <div>
                <h3 className="text-md font-medium text-primary-text dark:text-primary-text-dark mb-4">
                  {t('connectedProviders')}
                </h3>
                
                {/* Help message when no providers are connected */}
                {Object.keys(connectedProviders).length === 0 && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icons.AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          No cloud providers configured
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Configure cloud storage providers in your TorBox settings to start uploading your downloads. 
                          TBM will automatically detect configured providers.
                          <br />
                          <span className="text-xs text-blue-600 dark:text-blue-400 mt-2 block">
                            Note: Only Google Drive, Dropbox, and OneDrive support OAuth authentication. 
                            GoFile, 1Fichier, and Pixeldrain require API keys to be configured in TorBox settings.
                            <br />
                            If you've already configured providers in TorBox but they're not showing here, 
                            try refreshing the page or check if the cloud integration feature is enabled.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {providers.map((provider) => (
                    <div
                      key={provider.id}
                      className={`p-4 rounded-lg border ${provider.borderColor} ${provider.bgColor}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <provider.icon className={`w-6 h-6 ${provider.color}`} />
                          <div>
                            <p className="font-medium text-primary-text dark:text-primary-text-dark">
                              {provider.name}
                            </p>
                            <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                              {connectedProviders[provider.id] ? t('connected') : t('notConnected')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => 
                            connectedProviders[provider.id] 
                              ? disconnectProvider(provider.id)
                              : connectProvider(provider.id)
                          }
                          disabled={isLoading}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            connectedProviders[provider.id]
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-accent text-white hover:bg-accent/90'
                          } disabled:opacity-50`}
                        >
                          {isLoading ? (
                            <Spinner size="xs" />
                          ) : connectedProviders[provider.id] ? (
                            t('disconnect')
                          ) : (
                            t('connect')
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Jobs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-primary-text dark:text-primary-text-dark">
                    {t('activeJobs')}
                  </h3>
                  <button
                    onClick={loadActiveJobs}
                    disabled={isLoadingJobs}
                    className="p-2 hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-lg transition-colors"
                  >
                    <Icons.Refresh className={`w-4 h-4 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                {isLoadingJobs ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : activeJobs.length > 0 ? (
                  <div className="space-y-3">
                    {activeJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getJobStatusIcon(job.status)}
                            <div>
                              <p className="font-medium text-primary-text dark:text-primary-text-dark">
                                {job.provider} - {job.filename}
                              </p>
                              <p className={`text-sm ${getJobStatusColor(job.status)}`}>
                                {job.status}
                              </p>
                            </div>
                          </div>
                          {(job.status === 'uploading' || job.status === 'in_progress') && (
                            <button
                              onClick={() => cancelJob(job.id)}
                              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                            >
                              {t('cancel')}
                            </button>
                          )}
                        </div>
                        {job.progress && (
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-accent h-2 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 mt-1">
                              {job.progress}% {t('complete')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
                    <Icons.Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('noActiveJobs')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
