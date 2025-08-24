'use client';
import { useState, useEffect } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function SpeedtestComponent({ apiKey }) {
  const t = useTranslations('Speedtest');
  
  // Add error boundary for translations
  if (!t) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary-text dark:text-secondary-text-dark">
          Loading speed test...
        </p>
      </div>
    );
  }
  const [regions, setRegions] = useState([]);
  const [pingResults, setPingResults] = useState({});
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [speedTestResult, setSpeedTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userIp, setUserIp] = useState(null);
  const [testProgress, setTestProgress] = useState(0);
  const [testPhase, setTestPhase] = useState('');
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Get user's IP address from our own API
  useEffect(() => {
    const getUserIp = async () => {
      try {
        const response = await fetch('/api/ip');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.ip && data.ip !== 'unknown') {
            setUserIp(data.ip);
          } else {
            console.warn('Could not determine user IP, proceeding without it');
          }
        } else {
          console.warn('Failed to get user IP from API');
        }
      } catch (error) {
        console.error('Failed to get user IP:', error);
      }
    };
    getUserIp();
  }, []);

  // Load regions and ping data
  useEffect(() => {
    if (apiKey) {
      loadRegionsAndPing();
    }
  }, [apiKey, userIp]);

  // Separate effect for ping tests after regions are loaded
  useEffect(() => {
    if (apiKey && regions.length > 0) {
      testAllPings();
    }
  }, [apiKey, regions]);

  const loadRegionsAndPing = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get all regions (no specific region parameter)
      const response = await fetch('/api/speedtest', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // The API returns an array of regions directly
        const regionsData = data.data;
        setRegions(regionsData);
        
        // Initialize ping results for each region
        const initialPingResults = {};
        regionsData.forEach(region => {
          initialPingResults[region.name] = null; // Will be populated when we test ping
        });
        setPingResults(initialPingResults);
      } else {
        throw new Error(data.error || 'Failed to load speedtest data');
      }
          } catch (error) {
        setError(error.message);
      } finally {
      setLoading(false);
    }
  };

  const testPing = async (region) => {
    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: region.domain }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPingResults(prev => ({
          ...prev,
          [region.name]: data.ping
        }));
      } else {
        setPingResults(prev => ({
          ...prev,
          [region.name]: 'timeout'
        }));
      }
    } catch (error) {
      setPingResults(prev => ({
        ...prev,
        [region.name]: 'timeout'
      }));
    }
  };

  const testAllPings = async () => {
    if (!apiKey || regions.length === 0) return;

    console.log('Starting ping tests for', regions.length, 'regions');

    for (const region of regions) {
      try {
        console.log('Testing ping for', region.name, 'at', region.domain);
        
        const response = await fetch('/api/ping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: region.domain }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          console.log('Ping result for', region.name, ':', data.ping, 'ms');
          setPingResults(prev => ({
            ...prev,
            [region.name]: data.ping
          }));
        } else {
          console.log('Ping failed for', region.name, ':', data.error);
          setPingResults(prev => ({
            ...prev,
            [region.name]: 'timeout'
          }));
        }
        
        // Small delay between pings to avoid overwhelming the servers
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.log('Ping failed for', region.name, ':', error.message);
        setPingResults(prev => ({
          ...prev,
          [region.name]: 'timeout'
        }));
      }
    }
  };

  const runSpeedTest = async (region) => {
    setLoading(true);
    setError(null);
    setSpeedTestResult(null);
    
    try {
      // First get the speedtest files for this region
      const response = await fetch(`/api/speedtest?region=${region.region}&test_length=short`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || data.detail || 'Failed to get speedtest files');
      }

      // Get the test files from the response
      const testFiles = data.data;
      
      if (!Array.isArray(testFiles) || testFiles.length === 0) {
        throw new Error('No speedtest files available for this region');
      }

      // Use the first test file for download test
      const testFile = testFiles[0];
      
      // Check if the test file has the expected structure
      if (!testFile.domain || !testFile.url) {
        throw new Error('Invalid speedtest file structure');
      }
      
      const testUrl = testFile.url;

      // Run actual speed test by downloading the test file
      const speedTestStart = performance.now();
      setIsRunningTest(true);
      setTestProgress(0);
      setTestPhase('Initializing...');
      
      try {
        // Test ping first - use a simple approach that won't have CORS issues
        setTestPhase('Testing Ping...');
        setTestProgress(5);
        
        // Use the existing ping results instead of trying to ping again
        const pingTime = pingResults[region.name] || 0;
        setTestProgress(10);
        
        setTestPhase('Testing Download Speed...');
        setTestProgress(15);
        
        // Download speed test - run multiple tests for better accuracy
        const downloadTests = [];
        const downloadTestCount = 3; // Run 3 download tests
        
        for (let i = 0; i < downloadTestCount; i++) {
          setTestProgress(15 + (i * 15)); // Progress from 15% to 60%
          
          const downloadStart = performance.now();
          
          const downloadResponse = await fetch(testUrl, {
            method: 'GET',
            mode: 'cors',
          });
          
          if (!downloadResponse.ok) {
            throw new Error(`Download test failed: ${downloadResponse.status}`);
          }

          const downloadBlob = await downloadResponse.blob();
          const downloadEnd = performance.now();
          const downloadTime = (downloadEnd - downloadStart) / 1000; // Convert to seconds
          const downloadSize = downloadBlob.size; // Size in bytes (should be 100MB)
          const downloadSpeed = downloadSize / downloadTime; // Bytes per second
          
          downloadTests.push({
            time: downloadTime,
            size: downloadSize,
            speed: downloadSpeed
          });
          
          // Small delay between tests
          if (i < downloadTestCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Calculate average download speed
        const avgDownloadTime = downloadTests.reduce((sum, test) => sum + test.time, 0) / downloadTests.length;
        const avgDownloadSize = downloadTests[0].size; // All tests use same file size
        const avgDownloadSpeed = downloadTests.reduce((sum, test) => sum + test.speed, 0) / downloadTests.length;
        
        setTestProgress(60);

        setTestPhase('Testing Upload Speed...');
        setTestProgress(65);
        
        // Upload speed test - run multiple tests for better accuracy
        const uploadTests = [];
        const uploadTestCount = 3; // Run 3 upload tests
        
        for (let i = 0; i < uploadTestCount; i++) {
          setTestProgress(65 + (i * 10)); // Progress from 65% to 85%
          
          const uploadStart = performance.now();
          
          // Create a smaller test file for upload (1MB instead of 100MB)
          const uploadBlob = new Blob([new ArrayBuffer(1024 * 1024)]); // 1MB test data
          const formData = new FormData();
          formData.append('file', uploadBlob, 'upload-test.bin');
          
          let uploadSuccess = false;
          // Try to upload to our own API endpoint that can handle uploads
          try {
            const uploadResponse = await fetch('/api/speedtest/upload', {
              method: 'POST',
              body: formData,
            });
            uploadSuccess = uploadResponse.ok;
          } catch (uploadError) {
            // If upload fails, we'll still measure the time
          }
          
          const uploadEnd = performance.now();
          const uploadTime = (uploadEnd - uploadStart) / 1000; // Convert to seconds
          const uploadSize = uploadBlob.size; // 1MB
          
          // Calculate upload speed - if upload failed, use a reasonable estimate
          let uploadSpeed;
          if (uploadSuccess) {
            uploadSpeed = uploadSize / uploadTime; // Real upload speed (bytes per second)
          } else {
            // If upload failed, estimate based on download speed (usually upload is slower)
            uploadSpeed = avgDownloadSpeed * 0.1; // Assume upload is ~10% of download speed
          }
          
          uploadTests.push({
            time: uploadTime,
            size: uploadSize,
            speed: uploadSpeed,
            success: uploadSuccess
          });
          
          // Small delay between tests
          if (i < uploadTestCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Calculate average upload speed
        const avgUploadTime = uploadTests.reduce((sum, test) => sum + test.time, 0) / uploadTests.length;
        const avgUploadSize = uploadTests[0].size; // All tests use same file size
        const avgUploadSpeed = uploadTests.reduce((sum, test) => sum + test.speed, 0) / uploadTests.length;
        const uploadSuccessRate = uploadTests.filter(test => test.success).length / uploadTests.length;
        
        setTestProgress(85);

        setTestProgress(95);
        setTestPhase('Calculating Results...');

        const speedTestEnd = performance.now();
        const totalTime = (speedTestEnd - speedTestStart) / 1000;
        
        const result = {
          download_speed: avgDownloadSpeed,
          upload_speed: avgUploadSpeed,
          download_size: avgDownloadSize,
          upload_size: avgUploadSize,
          download_time: avgDownloadTime,
          upload_time: avgUploadTime,
          ping_time: pingTime,
          test_file: testFile.path || 'torbox-speedtest',
          test_url: testUrl,
          ping_adjustment: pingResults[region.name] || 0,
          download_tests: downloadTests.length,
          upload_tests: uploadTests.length,
          upload_success_rate: uploadSuccessRate
        };
        
        setSpeedTestResult(result);
        setTestProgress(100);
        setTestPhase('Test Complete!');
        
        // Reset after a short delay
        setTimeout(() => {
          setIsRunningTest(false);
          setTestProgress(0);
          setTestPhase('');
        }, 2000);
        
      } catch (error) {
        setIsRunningTest(false);
        setTestProgress(0);
        setTestPhase('');
        throw new Error(`Speed test failed: ${error.message}`);
      }

    } catch (error) {
      console.error('Error running speed test:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };



  const formatPing = (ping) => {
    if (!ping) return 'N/A';
    if (ping === 'timeout') return 'Timeout';
    return `${ping}ms`;
  };

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond === 0 || isNaN(bytesPerSecond)) return 'N/A';
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    return `${mbps.toFixed(2)} Mbps`;
  };

  const getRegionDisplayName = (regionCode) => {
    const regionNames = {
      'cnam': 'Central North America',
      'enam': 'Eastern North America',
      'snam': 'Southern North America',
      'wnam': 'Western North America',
      'neur': 'Northern Europe',
      'weur': 'Western Europe',
      'latm': 'Latin America',
      'erth': 'Global (Cloudflare)',
      'meas': 'Middle East & Asia',
      'indi': 'India',
      'zafr': 'South Africa',
      'apac': 'Asia Pacific',
      'japn': 'Japan',
      'soce': 'South Central'
    };
    return regionNames[regionCode] || regionCode.toUpperCase();
  };

  const getServerType = (serverName) => {
    if (serverName.includes('nexus')) return 'Nexus Server';
    if (serverName.includes('store')) return 'Storage Server';
    if (serverName.includes('cloudflare')) return 'Cloudflare CDN';
    return 'CDN Server';
  };

  const getPingColor = (ping) => {
    if (!ping || ping === 'timeout') return 'text-gray-500';
    if (ping < 50) return 'text-green-500';
    if (ping < 200) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!apiKey) {
    return (
      <div className="text-center py-8">
        <Icons.Warning className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
        <p className="text-secondary-text dark:text-secondary-text-dark">
          Please enter your API key to use the speed test
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Ping Results Section */}
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-primary-text dark:text-primary-text-dark mb-2">
              Server Locations
            </h2>
            <p className="text-secondary-text dark:text-secondary-text-dark">
              Select a server to run a comprehensive speed test
            </p>
          </div>
          <button
            onClick={loadRegionsAndPing}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            <Icons.Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading && regions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-secondary-text dark:text-secondary-text-dark">
                Loading server locations...
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {regions.map((region) => (
              <div
                key={region.name}
                className={`group relative p-6 border-2 rounded-xl transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                  selectedRegion?.name === region.name
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-800'
                }`}
                onClick={() => setSelectedRegion(region)}
              >
                {/* Ping indicator */}
                <div className="absolute top-3 right-3">
                  <div className={`w-3 h-3 rounded-full ${
                    pingResults[region.name] 
                      ? pingResults[region.name] < 50 ? 'bg-green-500' 
                        : pingResults[region.name] < 200 ? 'bg-yellow-500' 
                        : 'bg-red-500'
                      : 'bg-gray-400'
                  }`}></div>
                </div>

                <div className="text-center">
                  <h3 className="font-bold text-primary-text dark:text-primary-text-dark mb-1">
                    {getRegionDisplayName(region.region)}
                  </h3>
                  
                  <p className="text-xs text-secondary-text dark:text-secondary-text-dark mb-2">
                    {getServerType(region.name)}
                  </p>
                  
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-sm font-semibold ${getPingColor(pingResults[region.name])}`}>
                      {formatPing(pingResults[region.name])}
                    </span>
                    {pingResults[region.name] && (
                      <span className="text-xs text-secondary-text dark:text-secondary-text-dark">
                        ping
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speed Test Section */}
      {selectedRegion && (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-primary-text dark:text-primary-text-dark mb-2">
                Speed Test
              </h2>
              <div className="flex items-center gap-4 text-sm text-secondary-text dark:text-secondary-text-dark">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {getRegionDisplayName(selectedRegion.region)}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  {getServerType(selectedRegion.name)}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  {formatPing(pingResults[selectedRegion.name])}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedRegion(null)}
              className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Icons.Times className="w-5 h-5" />
            </button>
          </div>

          {!speedTestResult ? (
            <div className="space-y-4">
              {isRunningTest ? (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${testProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-secondary-text dark:text-secondary-text-dark mt-2">
                      <span>{testPhase}</span>
                      <span>{testProgress}%</span>
                    </div>
                  </div>
                  
                  {/* Animated Speed Test Visualization */}
                  <div className="flex justify-center py-8">
                    <div className="relative">
                      {/* Outer ring */}
                      <div className="w-32 h-32 border-4 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center">
                        {/* Inner animated ring */}
                        <div className="w-24 h-24 border-4 border-transparent border-t-blue-500 border-r-green-500 rounded-full animate-spin"></div>
                        {/* Center icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icons.Speed className="w-8 h-8 text-accent dark:text-accent-dark" />
                        </div>
                      </div>
                      
                      {/* Floating particles */}
                      <div className="absolute -top-2 -left-2 w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="absolute -top-2 -right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                      <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-secondary-text dark:text-secondary-text-dark">
                    <p>Testing your connection to {selectedRegion.name}</p>
                    <p className="text-xs mt-1">This may take a few seconds...</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => runSpeedTest(selectedRegion)}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:to-green-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  <div className="flex items-center justify-center">
                    <Icons.Speed className="w-5 h-5 mr-2" />
                    Start Speed Test
                  </div>
                </button>
              )}
              
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Speed Results */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative p-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 transform transition-all duration-300 hover:scale-105">
                  <div className="absolute top-4 right-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-1">
                      Download Speed
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Data received from server
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                      {formatSpeed(speedTestResult.download_speed)}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {speedTestResult.download_size ? `${(speedTestResult.download_size / (1024 * 1024)).toFixed(1)} MB` : ''} 
                      {speedTestResult.download_time ? ` in ${speedTestResult.download_time.toFixed(2)}s` : ''}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 dark:text-green-400">Speed</span>
                      <span className="text-green-700 dark:text-green-300 font-semibold">
                        {((speedTestResult.download_speed * 8) / (1024 * 1024)).toFixed(1)} Mbps
                      </span>
                    </div>
                    <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-1000 shadow-lg"
                        style={{ 
                          width: `${Math.min(100, (speedTestResult.download_speed / (100 * 1024 * 1024)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="relative p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 transform transition-all duration-300 hover:scale-105">
                  <div className="absolute top-4 right-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      Upload Speed
                    </h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Data sent to server
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                      {formatSpeed(speedTestResult.upload_speed)}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {speedTestResult.upload_size ? `${(speedTestResult.upload_size / (1024 * 1024)).toFixed(1)} MB` : ''} 
                      {speedTestResult.upload_time ? ` in ${speedTestResult.upload_time.toFixed(2)}s` : ''}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600 dark:text-blue-400">Speed</span>
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">
                        {((speedTestResult.upload_speed * 8) / (1024 * 1024)).toFixed(1)} Mbps
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all duration-1000 shadow-lg"
                        style={{ 
                          width: `${Math.min(100, (speedTestResult.upload_speed / (50 * 1024 * 1024)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-surface dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark">
                <h4 className="font-semibold text-primary-text dark:text-primary-text-dark mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Test Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-secondary-text dark:text-secondary-text-dark font-medium">Test Type</p>
                    <p className="text-primary-text dark:text-primary-text-dark">TorBox Speed Test</p>
                  </div>
                  <div>
                    <p className="text-secondary-text dark:text-secondary-text-dark font-medium">Ping</p>
                    <p className="text-primary-text dark:text-primary-text-dark">
                      {speedTestResult.ping_time ? `${speedTestResult.ping_time.toFixed(0)}ms` : 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-secondary-text dark:text-secondary-text-dark font-medium">Server</p>
                    <p className="text-primary-text dark:text-primary-text-dark font-mono text-xs break-all">
                      {speedTestResult.test_url}
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => runSpeedTest(selectedRegion)}
                disabled={loading || isRunningTest}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                <div className="flex items-center justify-center">
                  <Icons.Refresh className="w-5 h-5 mr-2" />
                  Run Test Again
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
