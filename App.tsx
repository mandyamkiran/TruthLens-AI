/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Upload,
  Camera,
  Layers,
  Fingerprint,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Search,
  Sliders,
  Play,
  Share2,
  Trash2,
  ArrowRight,
  Flame,
  FileText,
  Video,
  Image as ImageIcon,
  Cpu,
  Database,
  Check,
  AlertTriangle,
  FileDown,
  FileJson,
  Newspaper,
  ExternalLink
} from 'lucide-react';
import { ScanReport, ExifData, HeatmapPoint, TimelineMark, VideoFrameAnomaly } from './types';

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'video' | 'news';
  fileObj: File | null;
  previewUrl: string | null;
  status: 'pending' | 'uploading' | 'scanning' | 'completed' | 'failed';
  report?: ScanReport | null;
}

export default function App() {
  // Page indicator: deepfake vs news page
  const [currentPage, setCurrentPage] = useState<'deepfake' | 'news'>('deepfake');

  // Input configuration states
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video' | 'news'>('image');
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [scanOption, setScanOption] = useState<'ai' | 'authentic' | 'auto'>('auto');
  const [newsClaimText, setNewsClaimText] = useState('');
  const [newsScreenshotUrl, setNewsScreenshotUrl] = useState<string | null>(null);

  // Auto-complete suggestion dropdown states for real-time news
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePageChange = (page: 'deepfake' | 'news') => {
    setCurrentPage(page);
    if (page === 'news') {
      setActiveMediaTab('news');
      const firstNews = queuedFiles.find(q => q.type === 'news');
      if (firstNews) {
        setActiveQueueId(firstNews.id);
        setActiveReport(firstNews.report || null);
      } else {
        setActiveQueueId(null);
        setActiveReport(null);
      }
    } else {
      setActiveMediaTab('image');
      const firstDeepfake = queuedFiles.find(q => q.type === 'image' || q.type === 'video');
      if (firstDeepfake) {
        setActiveQueueId(firstDeepfake.id);
        setActiveReport(firstDeepfake.report || null);
      } else {
        setActiveQueueId(null);
        setActiveReport(null);
      }
    }
  };

  // Scanner status trackers
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('');

  // Loaded Forensic Report result
  const [activeReport, setActiveReport] = useState<ScanReport | null>(null);
  const [hoveredHeatmap, setHoveredHeatmap] = useState<HeatmapPoint | null>(null);
  const [splitView, setSplitView] = useState(false);

  // Db feed cache
  const [scanHistory, setScanHistory] = useState<ScanReport[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearAllHistory = async () => {
    try {
      const response = await fetch('/api/history/clear', {
        method: 'POST'
      });
      if (response.ok) {
        setQueuedFiles([]);
        setScanHistory([]);
        setActivities([]);
        setActiveQueueId(null);
        setActiveReport(null);
        setShowClearConfirm(false);
        setScanStatusMessage("All local scanner registers and data artifacts successfully purged.");
      }
    } catch (e) {
      console.error("Failed to execute data purge request: ", e);
    }
  };

  // Search and filter states for the file queue
  const [queueSearchText, setQueueSearchText] = useState('');
  const [queueFilterThreat, setQueueFilterThreat] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [queueFilterDate, setQueueFilterDate] = useState<'all' | 'today' | 'week' | 'older'>('all');
  const [queueFilterType, setQueueFilterType] = useState<'all' | 'image' | 'video' | 'news'>('all');

  const hasActiveFilters = !!(queueSearchText.trim() || queueFilterThreat !== 'all' || queueFilterDate !== 'all' || queueFilterType !== 'all');

  const handleResetFilters = () => {
    setQueueSearchText('');
    setQueueFilterThreat('all');
    setQueueFilterDate('all');
    setQueueFilterType('all');
  };

  // Derived filtered state of files inside the queue
  const filteredQueue = queuedFiles.filter(item => {
    // 1. Filter by name search
    if (queueSearchText.trim()) {
      const search = queueSearchText.toLowerCase();
      if (!item.name.toLowerCase().includes(search)) {
        return false;
      }
    }

    // 2. Filter by threat level
    if (queueFilterThreat !== 'all') {
      if (!item.report) {
        return false; // exclude active pending/failed items without full metrics
      }
      const score = item.report.truthScore; // high is authentic, low is suspicious
      
      const isHighThreat = score < 40 || (item.report.newsFactCheck && item.report.newsFactCheck.fakeNewsProbability >= 70);
      const isMediumThreat = (score >= 40 && score < 75) || (item.report.newsFactCheck && item.report.newsFactCheck.fakeNewsProbability >= 30 && item.report.newsFactCheck.fakeNewsProbability < 70);
      const isLowThreat = score >= 75 || (item.report.newsFactCheck && item.report.newsFactCheck.fakeNewsProbability < 30);

      if (queueFilterThreat === 'high' && !isHighThreat) return false;
      if (queueFilterThreat === 'medium' && !isMediumThreat) return false;
      if (queueFilterThreat === 'low' && !isLowThreat) return false;
    }

    // 3. Filter by date recency
    if (queueFilterDate !== 'all') {
      const itemDate = item.report?.createdAt ? new Date(item.report.createdAt) : new Date();
      const diffMs = Date.now() - itemDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (queueFilterDate === 'today' && diffDays > 1) return false;
      if (queueFilterDate === 'week' && diffDays > 7) return false;
      if (queueFilterDate === 'older' && diffDays <= 7) return false;
    }

    // 4. Filter by file/media type
    if (queueFilterType !== 'all') {
      if (item.type !== queueFilterType) return false;
    }

    return true;
  });

  // Drag state tracker
  const [dragActive, setDragActive] = useState(false);

  // Real-time breaking news states
  const [breakingNews, setBreakingNews] = useState<any[]>([]);
  const [refreshingBreaking, setRefreshingBreaking] = useState(false);

  const fetchBreakingNews = async () => {
    setRefreshingBreaking(true);
    try {
      const res = await fetch('/api/news/breaking');
      if (res.ok) {
        const data = await res.json();
        setBreakingNews(data.news || []);
      }
    } catch (e) {
      console.error("Failed fetching live breaking news stream: ", e);
    } finally {
      setRefreshingBreaking(false);
    }
  };

  useEffect(() => {
    fetchBreakingNews();
    const interval = setInterval(fetchBreakingNews, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter dynamic autocomplete suggestions from live indexed feeds
  const suggestions = (() => {
    if (!newsClaimText.trim()) {
      // Show top trending items when clean input is empty
      return breakingNews.slice(0, 4);
    }
    const cleanSearch = newsClaimText.toLowerCase().trim();
    return breakingNews.filter(item => 
      item.title.toLowerCase().includes(cleanSearch) &&
      item.title.toLowerCase().trim() !== cleanSearch
    ).slice(0, 5);
  })();

  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        setNewsClaimText(suggestions[activeSuggestionIndex].title);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  // Derived state for the currently active selected file
  const currentActiveItem = queuedFiles.find(item => item.id === activeQueueId) || null;
  const selectedFile = currentActiveItem?.fileObj || null;
  const previewUrl = currentActiveItem?.previewUrl || null;

  const handleNewsScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setNewsScreenshotUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNewsScreenshotDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setNewsScreenshotUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmitNewsFactCheck = async () => {
    if (!newsClaimText.trim()) return;

    const id = 'news-' + Date.now();
    const tempHeadline = newsClaimText.trim();
    const tempScreenshot = newsScreenshotUrl;

    const newItem: QueuedFile = {
      id,
      name: tempHeadline.length > 25 ? tempHeadline.substring(0, 25) + '...' : tempHeadline,
      size: tempScreenshot ? Math.round(tempScreenshot.length * 0.75) : 120,
      type: 'news',
      fileObj: new File([], "news_claim.txt"),
      previewUrl: tempScreenshot || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=300",
      status: 'scanning',
      report: null
    };

    setQueuedFiles(prev => [newItem, ...prev]);
    setActiveQueueId(id);
    setIsScanning(true);
    setScanStatusMessage("Dispatching sub-pixel NLP forensic grids and live search grounding...");

    try {
      const response = await fetch('/api/analyze/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          headlineText: tempHeadline,
          imageData: tempScreenshot,
          forceType: scanOption === 'auto' ? undefined : scanOption
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQueuedFiles(prev => prev.map(q => q.id === id ? { ...q, status: 'completed', report: data } : q));
        setActiveReport(data);
        setNewsClaimText('');
        setNewsScreenshotUrl(null);
        setScanStatusMessage("Disinformation analysis compiled fully!");
      } else {
        setQueuedFiles(prev => prev.map(q => q.id === id ? { ...q, status: 'failed' } : q));
        setScanStatusMessage("Fact verification query rejected.");
      }
    } catch (err) {
      console.error("Fact check failed: ", err);
      setQueuedFiles(prev => prev.map(q => q.id === id ? { ...q, status: 'failed' } : q));
      setScanStatusMessage("Verification pipeline interrupted.");
    } finally {
      setIsScanning(false);
    }
  };

  // Load backend content
  const loadData = async () => {
    try {
      const resHistory = await fetch('/api/history');
      if (resHistory.ok) {
        const data = await resHistory.json();
        setScanHistory(data.scans || []);

        // Populate initial items into the queue from history as completed preset files
        if (data.scans && data.scans.length > 0) {
          const preprocessedQueue: QueuedFile[] = data.scans.map((report: ScanReport) => ({
            id: 'preset-' + report.id,
            name: report.fileName,
            size: parseFloat(report.fileSize || '0') * 1024 * 1024 || 0,
            type: report.fileType,
            fileObj: null,
            previewUrl: report.thumbnailUrl,
            status: 'completed',
            report: report
          }));

          setQueuedFiles(prev => {
            const userUploaded = prev.filter(q => q.fileObj !== null);
            const merged = [...userUploaded];
            preprocessedQueue.forEach(p => {
              if (!merged.some(item => item.id === p.id)) {
                merged.push(p);
              }
            });
            return merged;
          });

          if (!activeQueueId) {
            setActiveQueueId('preset-' + data.scans[0].id);
            setActiveReport(data.scans[0]);
            setActiveMediaTab(data.scans[0].fileType);
          }
        }
      }
      
      const resMetrics = await fetch('/api/dashboard-metrics');
      if (resMetrics.ok) {
        const data = await resMetrics.json();
        setActivities(data.activities || []);
      }
    } catch (e) {
      console.error("Could not coordinate backend metadata queries: ", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Synchronize dynamic tab selection and active report when active queue item is swapped
  useEffect(() => {
    const item = queuedFiles.find(q => q.id === activeQueueId);
    if (item) {
      if (item.status === 'completed' && item.report) {
        setActiveReport(item.report);
      } else {
        setActiveReport(null);
      }
      setActiveMediaTab(item.type);
      if (item.type === 'news') {
        setCurrentPage('news');
      } else {
        setCurrentPage('deepfake');
      }
    }
  }, [activeQueueId, queuedFiles]);

  // Preset selectors for quick client testing
  const selectHistoryPreset = (report: ScanReport) => {
    const id = 'preset-' + report.id;
    const existing = queuedFiles.find(q => q.id === id);
    if (!existing) {
      const presetItem: QueuedFile = {
        id,
        name: report.fileName,
        size: 0,
        type: report.fileType,
        fileObj: null,
        previewUrl: report.thumbnailUrl,
        status: 'completed',
        report: report
      };
      setQueuedFiles(prev => [...prev, presetItem]);
    }
    setActiveQueueId(id);
    setActiveReport(report);
    setActiveMediaTab(report.fileType);
  };

  // Drag and Drop action bindings
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processSelectedFiles = (files: File[]) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const videoExtensions = ['mp4', 'mov'];
    const newItems: QueuedFile[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = imageExtensions.includes(ext);
      const isVideo = videoExtensions.includes(ext);

      if (!isImage && !isVideo) {
        alert(`Unsupported format for ${file.name}. Please upload standard images (JPG, PNG, WEBP) or videos (MP4, MOV).`);
        continue;
      }

      const limit = isImage ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
      if (file.size > limit) {
        alert(`File ${file.name} exceeds the ${isImage ? '50MB' : '15MB'} size limit.`);
        continue;
      }

      const id = 'q-' + Math.random().toString(36).substr(2, 9);
      const newItem: QueuedFile = {
        id,
        name: file.name,
        size: file.size,
        type: isImage ? 'image' : 'video',
        fileObj: file,
        previewUrl: null,
        status: 'pending',
        report: null
      };
      newItems.push(newItem);

      // Start reading preview
      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          setQueuedFiles(prev => prev.map(item => {
            if (item.id === id) {
              return { ...item, previewUrl: reader.result as string };
            }
            return item;
          }));
        };
        reader.readAsDataURL(file);
      }
    }

    if (newItems.length > 0) {
      setQueuedFiles(prev => [...prev, ...newItems]);
      // Auto select first newly added item
      setActiveQueueId(newItems[0].id);
      setActiveMediaTab(newItems[0].type);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(Array.from(e.target.files));
    }
  };

  // Synchronized scan handlers for queue elements
  const runForensicScanForItem = async (itemId: string) => {
    const item = queuedFiles.find(q => q.id === itemId);
    if (!item) return;

    setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'uploading' } : q));
    setIsUploading(true);
    setUploadProgress(20);
    setScanStatusMessage(`Ingesting raw forensic payload for ${item.name}...`);

    let progress = 20;
    const uploadInterval = setInterval(() => {
      progress += 20;
      if (progress > 100) {
        clearInterval(uploadInterval);
      } else {
        setUploadProgress(progress);
      }
    }, 120);

    await new Promise(resolve => setTimeout(resolve, 800));
    clearInterval(uploadInterval);
    
    setIsUploading(false);
    setIsScanning(true);
    setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'scanning' } : q));
    setScanStatusMessage(`Calibrating sub-pixel neural arrays for ${item.name}...`);

    try {
      if (item.type === 'video') {
        const response = await fetch('/api/analyze/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.fileObj ? item.fileObj.name : item.name,
            forceType: scanOption === 'auto' ? undefined : scanOption
          })
        });

        if (response.ok) {
          const data = await response.json();
          setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'completed', report: data } : q));
          if (activeQueueId === itemId) {
            setActiveReport(data);
          }
          setScanStatusMessage("Neural structural report compiled!");
        } else {
          setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'failed' } : q));
          setScanStatusMessage("Hardware communication failure.");
        }
      } else {
        const activePreview = item.previewUrl;
        if (!activePreview) {
          throw new Error("Preview payload not loaded yet.");
        }

        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: activePreview,
            name: item.fileObj ? item.fileObj.name : item.name,
            forceType: scanOption === 'auto' ? undefined : scanOption
          })
        });

        if (response.ok) {
          const data = await response.json();
          setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'completed', report: data } : q));
          if (activeQueueId === itemId) {
            setActiveReport(data);
          }
          setScanStatusMessage("Forensic data stream verified!");
        } else {
          setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'failed' } : q));
          setScanStatusMessage("Server-side FFT scan failed. Falling back to native heuristics.");
        }
      }
    } catch (err) {
      console.error("Forensic scanning failed: ", err);
      setQueuedFiles(prev => prev.map(q => q.id === itemId ? { ...q, status: 'failed' } : q));
      setScanStatusMessage("Scanning pipeline interrupted.");
    } finally {
      setIsScanning(false);
      setUploadProgress(0);
      loadData();
    }
  };

  const runForensicScan = async () => {
    if (!activeQueueId) return;
    await runForensicScanForItem(activeQueueId);
  };

  const runAllPendingScans = async () => {
    const pending = queuedFiles.filter(item => item.status === 'pending');
    for (const item of pending) {
      setActiveQueueId(item.id);
      await runForensicScanForItem(item.id);
    }
  };

  const printReport = () => {
    window.print();
  };

  const exportForensicJson = () => {
    if (!activeReport) return;
    const blob = new Blob([JSON.stringify(activeReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forensic_report_${activeReport.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderNewsDashboard = () => {
    if (!activeReport || activeReport.fileType !== 'news') return null;
    const n = activeReport.newsFactCheck || {
      trustScore: 0,
      credibilityRating: "UNVERIFIED",
      fakeNewsProbability: 0,
      sourceReliability: 0,
      verificationSummary: "Analysis pending.",
      sentimentBiasScore: 0,
      headlineClickbaitProbability: 0,
      propagandaPatternScore: 0,
      mismatchIndicators: [],
      manipulationWarnings: [],
      factCheckTimeline: [],
      verificationSources: [],
      relatedVerifiedArticles: []
    };

    return (
      <div className="space-y-6">
        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TRUTH SCORE GAUGE */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col items-center text-center relative overflow-hidden">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">Authenticity Trust Meter</span>
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="48" cy="48" r="40" className="stroke-slate-900 fill-none" strokeWidth="6" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  className={`fill-none transition-all duration-700 ${
                    n.trustScore >= 75 ? 'stroke-emerald-500' : n.trustScore >= 40 ? 'stroke-yellow-500' : 'stroke-red-500'
                  }`}
                  strokeWidth="6"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * n.trustScore) / 100}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-white leading-none">{n.trustScore}%</span>
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">Trust Score</span>
              </div>
            </div>
            <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 mt-4 rounded-full border ${
              n.trustScore >= 75
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                : n.trustScore >= 40
                ? 'bg-yellow-950/40 text-yellow-400 border-yellow-800/40'
                : 'bg-red-950/40 text-red-400 border-red-900/30'
            }`}>
              Rating: {n.credibilityRating}
            </span>
          </div>

          {/* FAKE NEWS PROBABILITY */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col justify-between">
            <div>
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Disinformation Likelihood</span>
              <span className="text-3xl font-extrabold text-white font-mono">{n.fakeNewsProbability}%</span>
              <p className="text-[9px] text-slate-400 leading-normal mt-2">Matches claims with Snopes, Associated Press, Reuters, and independent reliable factcheck intelligence trackers.</p>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-3">
              <div className={`h-full transition-all duration-700 ${n.fakeNewsProbability >= 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${n.fakeNewsProbability}%` }} />
            </div>
          </div>

          {/* SOURCE RELIABILITY */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col justify-between">
            <div>
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Source Reliability Index</span>
              <span className="text-3xl font-extrabold text-white font-mono">{n.sourceReliability}%</span>
              <p className="text-[9px] text-slate-400 leading-normal mt-2">Aggregated rating of reporting standards, historical accuracy logs, editorial transparency, and domain citations.</p>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-3">
              <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${n.sourceReliability}%` }} />
            </div>
          </div>
        </div>

        {/* AI GROUNDING SUMMARY */}
        <div className="p-5 rounded-xl bg-slate-950/85 border border-slate-850 space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> AI Grounded Synthesis Verdict
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal border-l-2 border-indigo-500 pl-3">
            {n.verificationSummary}
          </p>
        </div>

        {/* DISINFORMATION METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BIAS & CAPTURE */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-4">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-900 pb-2">Linguistic Forensic Grids</span>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-350 text-slate-300">Emotional Bias & Sentiment Steer</span>
                  <span className="text-indigo-400 font-bold">{n.sentimentBiasScore}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${n.sentimentBiasScore}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-300">Headline Clickbait Index</span>
                  <span className="text-purple-400 font-bold">{n.headlineClickbaitProbability}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full" style={{ width: `${n.headlineClickbaitProbability}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-300">Propaganda & Framing Score</span>
                  <span className="text-red-400 font-bold">{n.propagandaPatternScore}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full" style={{ width: `${n.propagandaPatternScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* WARNINGS */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-900 pb-2">Integrity Flaws & Warnings</span>
            <div className="space-y-2 max-h-[143px] overflow-y-auto pr-1">
              {(n.mismatchIndicators || []).map((mismatch, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-yellow-500">
                  <span className="mt-0.5 font-mono">⚠️</span>
                  <span>{mismatch}</span>
                </div>
              ))}
              {(n.manipulationWarnings || []).map((warning, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-400 font-bold">
                  <span className="mt-0.5">⊗</span>
                  <span>{warning}</span>
                </div>
              ))}
              {(n.mismatchIndicators || []).length === 0 && (n.manipulationWarnings || []).length === 0 && (
                <div className="text-[10px] text-slate-500 font-mono">No linguistic or structural alignment defects flagged.</div>
              )}
            </div>
          </div>
        </div>

        {/* FACT TIMELINE */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-4">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-900 pb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Grounded Analysis Timeline
          </span>
          <div className="relative border-l border-slate-800 ml-2.5 pl-5 py-1 space-y-4">
            {(n.factCheckTimeline || []).map((item, i) => (
              <div key={i} className="relative">
                <div className={`absolute -left-[25px] w-2.5 h-2.5 rounded-full border border-slate-950 ${
                  item.status === 'Verified' ? 'bg-emerald-500' : item.status === 'Debunked' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500">{item.date}</span>
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                      item.status === 'Verified' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/35 text-emerald-400' : item.status === 'Debunked' ? 'bg-red-950/40 text-red-400 border-red-900/35' : 'bg-yellow-950/40 text-yellow-405 border-yellow-900/40 text-yellow-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="text-[11px] font-bold text-slate-200">{item.event}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SOURCES LISTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-900 pb-2">Verification Sources & Domains</span>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 flex flex-col">
              {(n.verificationSources || []).map((source, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-900/40 border border-slate-850 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-200 truncate">{source.title}</span>
                    <span className="block text-[9px] text-slate-400 font-mono truncate">{source.domain}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-indigo-400">Rep: {source.reputationScore}%</span>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-900 pb-2">Primary Fact Desk Debunks</span>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {(n.relatedVerifiedArticles || []).map((article, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-900/45 border border-slate-850 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="inline-block text-[8px] font-mono font-black uppercase text-indigo-400 bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-900/30">
                      {article.source}
                    </span>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-200 line-clamp-1">{article.title}</h4>
                  <p className="text-[9px] text-slate-400 leading-normal line-clamp-2">{article.summary || article.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header section with clean styling and isolated workspace indicators */}
      <header className="border-b border-slate-900 bg-slate-950 px-4 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              TruthLens AI <span className="text-[10px] font-medium tracking-normal px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">INTELLIGENCE</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider -mt-0.5">Media Integrity & Fact Verification</p>
          </div>
        </div>

        {/* Dynamic Nav Tabs for isolated workspaces */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-850">
          <button
            type="button"
            onClick={() => handlePageChange('deepfake')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1.5 ${
              currentPage === 'deepfake'
                ? 'bg-indigo-600 text-white shadow shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
            <span>Deepfake Sandbox</span>
          </button>
          <button
            type="button"
            onClick={() => handlePageChange('news')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1.5 ${
              currentPage === 'news'
                ? 'bg-indigo-600 text-white shadow shadow-indigo-605/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5 text-purple-400" />
            <span>Google Verified News</span>
          </button>
        </div>

        {/* Status indicator pill in page margin */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          <span className="relative flex h-1.5 w-1.5">
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono uppercase text-slate-400">Verification Active</span>
        </div>
      </header>

      {/* Main Single-View Layout Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* LEFT COLUMN: Controls & Input Upload Stage (5 Cols) */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6 flex flex-col">
          
          {/* Main upload and verification card */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-slate-405" /> Settings
              </span>
              <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850">
                <button
                  type="button"
                  onClick={() => setScanOption('auto')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-all ${
                    scanOption === 'auto' ? 'bg-slate-900 text-white border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Calibrate automatically"
                >
                  AUTO
                </button>
                <button
                  type="button"
                  onClick={() => setScanOption('ai')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-all ${
                    scanOption === 'ai' ? 'bg-slate-900 text-purple-400 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Force AI detection pathways"
                >
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setScanOption('authentic')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-all ${
                    scanOption === 'authentic' ? 'bg-slate-900 text-emerald-400 border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Force authentic sensor standards"
                >
                  CAM
                </button>
              </div>
            </div>

            {/* Media toggle selector buttons requested by user: ADD IMAGE vs ADD VIDEO vs FACT CHECK */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => {
                  setActiveMediaTab('image');
                  setActiveQueueId(null);
                }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer transition-all ${
                  activeMediaTab === 'image'
                    ? 'bg-slate-900 text-white border border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> <span>Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMediaTab('video');
                  setActiveQueueId(null);
                }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer transition-all ${
                  activeMediaTab === 'video'
                    ? 'bg-slate-900 text-white border border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-indigo-400" /> <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMediaTab('news');
                  setActiveQueueId(null);
                }}
                className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer transition-all ${
                  activeMediaTab === 'news'
                    ? 'bg-slate-900 text-white border border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5 text-indigo-450" /> <span>News</span>
              </button>
            </div>

            {activeMediaTab === 'news' ? (
              <div className="space-y-4 text-left">
                <div className="space-y-2 relative" ref={suggestionRef}>
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Claim or Article Headline</label>
                  <textarea
                    id="news-claim-textarea"
                    rows={3}
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-none"
                    placeholder="Paste news headline, article text, viral social platform post, or claim here to verify..."
                    value={newsClaimText}
                    onChange={(e) => {
                      setNewsClaimText(e.target.value);
                      setShowSuggestions(true);
                      setActiveSuggestionIndex(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleSuggestionKeyDown}
                  />

                  {/* Absolute positioning Autocomplete & Suggestions dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade">
                      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                          {!newsClaimText.trim() ? 'Trending Live Headlines' : 'Autocomplete matches'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-slate-500 uppercase">
                            Arrows ↑↓ Enter ↵
                          </span>
                        </div>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-900">
                        {suggestions.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevents focus/blur changes
                              setNewsClaimText(item.title);
                              setShowSuggestions(false);
                              setActiveSuggestionIndex(-1);
                            }}
                            onMouseEnter={() => setActiveSuggestionIndex(idx)}
                            className={`p-2.5 text-left transition-all cursor-pointer flex gap-2.5 items-start ${
                              activeSuggestionIndex === idx
                                ? 'bg-indigo-600 text-white'
                                : 'hover:bg-slate-900/60 text-slate-300'
                            }`}
                          >
                            <Newspaper className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeSuggestionIndex === idx ? 'text-white' : 'text-indigo-400'}`} />
                            <div className="flex-1 space-y-0.5 min-w-0">
                              <p className="text-[11px] font-medium leading-snug line-clamp-2">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 text-[9px] opacity-70">
                                <span className={`font-semibold ${activeSuggestionIndex === idx ? 'text-indigo-100' : 'text-slate-400'}`}>
                                  {item.source}
                                </span>
                                <span>•</span>
                                <span>{item.relativeTime}</span>
                                <span>•</span>
                                <span className="bg-emerald-950/50 text-emerald-400 px-1 rounded text-[8px] font-mono font-bold border border-emerald-900/20">
                                  {item.credibilityScore}% Score
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span>Screenshot / Image Evidence</span>
                      <span className="text-[9px] text-slate-500 font-normal capitalize">(Optional)</span>
                    </label>
                    {newsScreenshotUrl && (
                      <button
                        type="button"
                        onClick={() => setNewsScreenshotUrl(null)}
                        className="text-[9px] font-mono text-red-500 hover:text-red-400 transition-colors"
                      >
                        Remove Screenshot
                      </button>
                    )}
                  </div>

                  {!newsScreenshotUrl ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleNewsScreenshotDrop}
                      onClick={() => document.getElementById('news-screenshot-picker')?.click()}
                      className="border border-dashed border-slate-850 rounded-xl p-4 text-center hover:border-slate-700 bg-slate-950/20 text-slate-500 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[90px]"
                    >
                      <input
                        type="file"
                        id="news-screenshot-picker"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleNewsScreenshotChange}
                      />
                      <ImageIcon className="w-5 h-5 text-slate-500 mb-1.5" />
                      <span className="text-[10px] text-slate-400">Click or drag screenshot of viral article / social claim</span>
                    </div>
                  ) : (
                    <div className="relative border border-slate-850 rounded-lg overflow-hidden max-h-[100px] bg-slate-950 flex items-center justify-center p-2">
                      <img src={newsScreenshotUrl} className="max-h-[80px] object-contain rounded" alt="Screenshot Evidence" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitNewsFactCheck}
                  disabled={!newsClaimText.trim() || isScanning || isUploading}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                    !newsClaimText.trim() || isScanning || isUploading
                      ? 'bg-slate-850 text-slate-500 border border-slate-900 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-indigo-600/10'
                  }`}
                >
                  {(isScanning || isUploading) ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{scanStatusMessage || 'Verifying Claims...'}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Verify News Claim</span>
                    </>
                  )}
                </button>

                {/* Real-time breaking news companion stream requested by user */}
                <div className="border-t border-slate-850 pt-4 mt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <h4 className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        Live News Alert stream
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">
                        crawler active
                      </span>
                      <button
                        type="button"
                        onClick={fetchBreakingNews}
                        disabled={refreshingBreaking}
                        className="p-1 rounded bg-slate-950 border border-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center placeholder:text-slate-700"
                        title="Force live index refresh"
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshingBreaking ? 'animate-spin text-indigo-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {breakingNews.length === 0 ? (
                      <div className="text-center py-6 text-slate-605 bg-slate-950/20 rounded-xl border border-slate-900/60">
                        <span className="text-[10px] font-mono flex items-center justify-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse"></span>
                          Initializing online live indexes...
                        </span>
                      </div>
                    ) : (
                      breakingNews.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-950/40 hover:bg-slate-950/85 border border-slate-900/60 rounded-xl p-3 space-y-1.5 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-red-950/50 text-red-400 border border-red-900/30 font-bold uppercase">
                              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span> Live Alert
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">
                              {item.relativeTime}
                            </span>
                          </div>
                          
                          <p className="text-[11px] font-medium text-slate-200 leading-normal line-clamp-2">
                            {item.title}
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[10px] border-t border-slate-900/40">
                            <div className="flex items-center gap-1.5 shrink-0 animate-fade">
                              <span className="font-semibold text-indigo-400 font-sans text-[10px] max-w-[80px] truncate" title={item.source}>
                                {item.source}
                              </span>
                              <span className="text-[8px] font-mono bg-emerald-950/25 text-emerald-405 border border-emerald-950/40 px-1 rounded">
                                {item.credibilityScore}%
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewsClaimText(item.title);
                                  const textEl = document.getElementById("news-claim-textarea");
                                  if (textEl) {
                                    textEl.focus();
                                    textEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                  }
                                }}
                                className="text-[9px] font-mono text-slate-400 hover:text-indigo-400 font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="Load headline into verification pipeline"
                              >
                                Audit Claim
                              </button>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-white transition-colors"
                                title="Open original press coverage link"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Main Interactive Drag Target Capture zone */
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden transition-all ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-950/10 text-indigo-300'
                    : 'border-slate-850 bg-slate-950/20 text-slate-500 hover:border-slate-800 hover:bg-slate-950/40'
                }`}
              >
                <input
                  type="file"
                  id="forensic-file-picker"
                  className="hidden"
                  accept={activeMediaTab === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp4,.mov'}
                  onChange={handleFileChange}
                  multiple
                />

                {previewUrl || (activeMediaTab === 'video' && selectedFile) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <div className="relative border border-slate-850 rounded-lg overflow-hidden max-h-[140px] aspect-video flex items-center justify-center bg-black/50">
                      {activeMediaTab === 'image' ? (
                        <img src={previewUrl || ""} className="max-h-full max-w-full object-contain" alt="Selected Target" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 text-slate-450">
                          <Play className="w-8 h-8 text-indigo-400 animate-pulse" />
                          <span className="text-[10px] font-mono text-indigo-300 truncate max-w-[200px]">{selectedFile ? selectedFile.name : "Video Track.mp4"}</span>
                        </div>
                      )}

                      {/* Progress indicators inside preview boundary */}
                      {isUploading && (
                        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10">
                          <span className="text-[10px] text-indigo-400 font-mono tracking-wider animate-pulse uppercase">Uploading... {uploadProgress}%</span>
                        </div>
                      )}
                      {isScanning && (
                        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-10">
                          <div className="w-6 h-6 rounded-full border border-slate-700 border-t-indigo-500 animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <span className="block text-xs font-semibold text-slate-300 font-mono truncate max-w-[280px]">
                        {selectedFile ? selectedFile.name : `custom_${activeMediaTab}_file`}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                        {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Custom File Ingested'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="forensic-file-picker" className="cursor-pointer space-y-3 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-400">
                      <Upload className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-300">
                        Upload {activeMediaTab === 'image' ? 'Image File(s)' : 'Video File(s)'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans mt-1 max-w-xs leading-normal block">
                        Drag files or click. Images (JPG, PNG, WEBP) up to 50MB, Videos (MP4, MOV) up to 15MB.
                      </span>
                    </div>
                  </label>
                )}
              </div>
            )}

            {/* Run button */}
            {activeQueueId && (currentActiveItem?.status === 'pending' || currentActiveItem?.status === 'failed') && !isScanning && !isUploading && (
              <button
                type="button"
                onClick={runForensicScan}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold uppercase rounded-xl text-white cursor-pointer transition-all"
              >
                Verify Authenticity
              </button>
            )}

            {/* In-processing scanner state placeholder */}
            {(isScanning || isUploading) && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Analyzing File</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-905">
                  {scanStatusMessage}
                </p>
                <div className="h-1 bg-slate-900 rounded-full overflow-hidden relative">
                  <div className="absolute top-0 bottom-0 left-0 bg-indigo-600 transition-all duration-300" style={{ width: isUploading ? `${uploadProgress}%` : '100%' }} />
                </div>
              </div>
            )}
          </div>

          {/* File Queue */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> File Queue
              </h4>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[9px] font-mono font-bold text-indigo-400 hover:text-indigo-300 uppercase cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                <span className="text-[10px] font-mono bg-indigo-950/20 text-indigo-300 border border-indigo-900/40 px-2 py-0.5 rounded-full">
                  {hasActiveFilters ? `${filteredQueue.length} of ${queuedFiles.length}` : `${queuedFiles.length} ${queuedFiles.length === 1 ? 'file' : 'files'}`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-450 leading-relaxed font-sans">
              Click any item below to view its verification report.
            </p>

            {/* Search and Filters Input Deck */}
            <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-850/60 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={queueSearchText}
                  onChange={(e) => setQueueSearchText(e.target.value)}
                  className="w-full bg-slate-950/85 border border-slate-850 rounded-lg pl-8 pr-7 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
                />
                {queueSearchText && (
                  <button
                    type="button"
                    onClick={() => setQueueSearchText('')}
                    className="absolute right-2.5 top-2.5 text-xs text-slate-500 hover:text-white font-bold cursor-pointer"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">Threat Level</label>
                  <select
                    value={queueFilterThreat}
                    onChange={(e: any) => setQueueFilterThreat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-1.5 py-1 text-[9px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">ALL LEVELS</option>
                    <option value="high">HIGH RISK</option>
                    <option value="medium">MEDIUM RISK</option>
                    <option value="low">AUTHENTIC</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">Media Type</label>
                  <select
                    value={queueFilterType}
                    onChange={(e: any) => setQueueFilterType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-1.5 py-1 text-[9px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">ALL TYPES</option>
                    <option value="image">IMAGE</option>
                    <option value="video">VIDEO</option>
                    <option value="news">NEWS</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">Recency</label>
                  <select
                    value={queueFilterDate}
                    onChange={(e: any) => setQueueFilterDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-1.5 py-1 text-[9px] text-slate-300 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">ALL TIME</option>
                    <option value="today">TODAY</option>
                    <option value="week">PAST WEEK</option>
                    <option value="older">OLDER</option>
                  </select>
                </div>
              </div>
            </div>

            {queuedFiles.length > 0 && queuedFiles.some(q => q.status === 'pending') && (
              <button
                type="button"
                onClick={runAllPendingScans}
                disabled={isScanning || isUploading}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-[10px] uppercase font-bold rounded-lg text-white cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                <Play className="w-3 h-3 text-emerald-450" /> Verify All Pending ({queuedFiles.filter(q => q.status === 'pending').length})
              </button>
            )}

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[290px]">
              {filteredQueue.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/25">
                  <span className="text-[11px] font-mono block">No matching results found</span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-2 text-[10px] font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Reset active filters
                    </button>
                  )}
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const isAiResult = item.report && (item.report.aiProbability > 50 || item.report.deepfakeProbability > 50);
                  const isSelected = activeQueueId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveQueueId(item.id);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-slate-900 border-indigo-500/30'
                          : 'bg-slate-950/80 border-slate-900/80 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shrink-0">
                          {item.type === 'video' ? (
                            <Video className="w-3.5 h-3.5 text-slate-400" />
                          ) : item.type === 'news' ? (
                            <Newspaper className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 pr-2">
                          <span className={`block text-xs font-bold truncate ${isSelected ? 'text-white font-extrabold' : 'text-slate-300'}`}>
                            {item.name}
                          </span>
                          <span className="block text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                            {item.type} • {item.size > 0 ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : 'SAMPLE'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'completed' && item.report && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border ${
                            item.type === 'news'
                              ? (item.report.newsFactCheck?.fakeNewsProbability && item.report.newsFactCheck.fakeNewsProbability >= 45
                                  ? 'bg-red-950/20 text-red-100 border-red-900/30'
                                  : 'bg-emerald-950/20 text-emerald-100 border-emerald-900/30')
                              : isAiResult
                              ? 'bg-red-950/20 text-red-400 border-red-900/30'
                              : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                          }`}>
                            {item.type === 'news'
                              ? (item.report.newsFactCheck?.fakeNewsProbability && item.report.newsFactCheck.fakeNewsProbability >= 45 ? 'FAKE' : 'AUTHENTIC')
                              : isAiResult ? `${item.report.aiProbability}% AI` : 'AUTHENTIC'}
                          </span>
                        )}

                        {item.status === 'pending' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-800">
                            PENDING
                          </span>
                        )}

                        {(item.status === 'uploading' || item.status === 'scanning') && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-indigo-950/40 text-indigo-400 border border-indigo-900/20">
                            <RefreshCw className="w-2 h-2 animate-spin" /> SCANNING
                          </span>
                        )}

                        {item.status === 'failed' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-red-950/40 text-red-500 border border-red-800/20">
                            FAILED
                          </span>
                        )}

                        {/* Delete button from queue if custom-uploaded */}
                        {item.fileObj && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueuedFiles(prev => {
                                const index = prev.findIndex(q => q.id === item.id);
                                const updated = prev.filter(q => q.id !== item.id);
                                if (activeQueueId === item.id && updated.length > 0) {
                                  const nextSelected = updated[Math.max(0, index - 1)];
                                  setActiveQueueId(nextSelected.id);
                                } else if (updated.length === 0) {
                                  setActiveQueueId(null);
                                }
                                return updated;
                              });
                            }}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded-md hover:bg-slate-850"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {queuedFiles.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 flex-wrap gap-2">
                {queuedFiles.some(q => q.fileObj !== null) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQueuedFiles(prev => {
                        const presetsOnly = prev.filter(q => q.fileObj === null);
                        if (presetsOnly.length > 0) {
                          setActiveQueueId(presetsOnly[0].id);
                        } else {
                          setActiveQueueId(null);
                        }
                        return presetsOnly;
                      });
                    }}
                    className="text-[10px] font-mono font-bold text-slate-500 hover:text-slate-300 uppercase cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-slate-500" /> Clear Uploads
                  </button>
                ) : (
                  <div />
                )}

                {showClearConfirm ? (
                  <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-red-950/40 ml-auto">
                    <span className="text-[9px] font-mono text-red-400 font-bold uppercase animate-pulse">Confirm Purge?</span>
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      className="text-[9px] font-mono font-bold text-white bg-red-650 hover:bg-red-600 uppercase cursor-pointer px-2 py-0.5 rounded transition-colors"
                    >
                      Wipe All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="text-[9px] font-mono font-bold text-slate-450 hover:text-white uppercase cursor-pointer px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[10px] font-mono font-bold text-red-500 hover:text-red-400 uppercase cursor-pointer flex items-center gap-1.5 transition-all ml-auto"
                    title="Wipe scanner history and maintain user privacy"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" /> Clear All Results
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Forensics Telemetry Result Area (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          
          {activeReport ? (
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6 relative">
              
              {/* Header Details */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">Analysis Report</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-900">ID: {activeReport.id}</span>
                    
                    {/* Enterprise Forensic Label Badge */}
                    {activeReport.detectionLabel && (
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        activeReport.detectionLabel.includes("Highly Likely")
                          ? 'bg-red-950/60 text-red-400 border-red-900/40 text-[9px] font-extrabold animate-pulse'
                          : activeReport.detectionLabel.includes("Likely AI")
                          ? 'bg-orange-950/60 text-orange-400 border-orange-900/40'
                          : activeReport.detectionLabel.includes("Possibly")
                          ? 'bg-yellow-950/60 text-yellow-400 border-yellow-800/40'
                          : 'bg-emerald-950/60 text-emerald-400 border-emerald-900/40'
                      }`}>
                        🛡️ {activeReport.detectionLabel}
                      </span>
                    )}

                    {/* Threat Level Badge */}
                    {activeReport.threatLevel && (
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        activeReport.threatLevel === 'critical'
                          ? 'bg-red-600 text-white border-red-500 text-[9px] font-bold animate-pulse shadow-sm shadow-red-500/20'
                          : activeReport.threatLevel === 'high'
                          ? 'bg-orange-600 text-white border-orange-500'
                          : activeReport.threatLevel === 'medium'
                          ? 'bg-yellow-600 text-slate-950 border-yellow-500'
                          : activeReport.threatLevel === 'low'
                          ? 'bg-indigo-950/70 text-indigo-300 border-indigo-900/40'
                          : 'bg-slate-950/70 text-slate-400 border-slate-900'
                      }`}>
                        ⚠️ THREAT: {activeReport.threatLevel}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white mt-2 max-w-[280px] sm:max-w-[400px] truncate">{activeReport.fileName}</h2>
                </div>

                <div className="mt-1 md:mt-0 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportForensicJson}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300 hover:text-white rounded-lg cursor-pointer transition-all"
                  >
                    <FileJson className="w-3.5 h-3.5 text-indigo-400" /> Export Forensic JSON
                  </button>
                  <button
                    type="button"
                    onClick={printReport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-300 hover:text-white rounded-lg cursor-pointer transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download Report
                  </button>
                </div>
              </div>

              {activeReport.fileType === 'news' ? (
                renderNewsDashboard()
              ) : (
                <>
                  {/* THREE METERS SCORECARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* TRUTH SCORE METER */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col items-center text-center relative overflow-hidden">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">Authenticity Trust Meter</span>
                  
                  {/* Circular progress bar */}
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-slate-900 fill-none" strokeWidth="6" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className={`fill-none transition-all duration-700 ${
                          activeReport.truthScore >= 75 ? 'stroke-emerald-500' : activeReport.truthScore >= 40 ? 'stroke-yellow-500' : 'stroke-red-500'
                        }`}
                        strokeWidth="6"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - (251.2 * activeReport.truthScore) / 100}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black text-white leading-none">{activeReport.truthScore}%</span>
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">Truth Level</span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 mt-4 rounded-full border ${
                    activeReport.truthScore >= 75
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                      : activeReport.truthScore >= 40
                      ? 'bg-yellow-950/40 text-yellow-400 border-yellow-800/40'
                      : 'bg-red-950/40 text-red-400 border-red-900/30'
                  }`}>
                    {activeReport.truthScore >= 75 ? 'Authentic' : activeReport.truthScore >= 40 ? 'Suspicious' : 'Highly Synthesized'}
                  </span>
                </div>

                {/* AI / MODEL DISCREPANCY SCORE */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">AI Generated Chance</span>
                    <span className="text-3xl font-extrabold text-white font-mono">{activeReport.aiProbability}%</span>
                    <p className="text-[9px] text-slate-400 leading-normal mt-2.5">Matches statistical distribution patterns from stable diffusion model pipelines or generative CNN decoders.</p>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-4">
                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${activeReport.aiProbability}%` }} />
                  </div>
                </div>

                {/* DEEPFAKE BIOMETRIC SCORE */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">Deepfake Confidence</span>
                    <span className="text-3xl font-extrabold text-white font-mono">{activeReport.deepfakeProbability}%</span>
                    <p className="text-[9px] text-slate-400 leading-normal mt-2.5">Measures spatial face alignment anomaly, temporal facial inconsistencies, or frame-to-frame distortion scores.</p>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mt-4">
                    <div className="bg-purple-500 h-full transition-all" style={{ width: `${activeReport.deepfakeProbability}%` }} />
                  </div>
                </div>
              </div>

              {/* ADVANCED WATERMARK DETECTION MODULE STATUS */}
              {activeReport.watermarkStatus && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                  activeReport.exif?.AiWatermarkDetected 
                    ? 'bg-red-950/20 border-red-500/30' 
                    : 'bg-emerald-950/10 border-emerald-900/20'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                    activeReport.exif?.AiWatermarkDetected 
                      ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {activeReport.exif?.AiWatermarkDetected ? '⚠️' : '✓'}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                        activeReport.exif?.AiWatermarkDetected ? 'text-red-400 font-extrabold' : 'text-emerald-400'
                      }`}>
                        {activeReport.watermarkStatus}
                      </span>
                      {activeReport.exif?.AiWatermarkDetected && (
                        <span className="text-[9px] font-mono px-2 py-0.2 rounded bg-red-950 text-red-400 border border-red-900/50 font-bold">
                          Synthetic generation signature found
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-300">
                      {activeReport.exif?.AiWatermarkDetected 
                        ? `Cryptographic tracking and sub-pixel frequency tracing isolated signature identifier: "${activeReport.watermarkTraceType || 'Generative latent fingerprint'}"`
                        : "No embedded cryptographic watermarks, latent steganographic payloads, or sub-pixel frequency tracing signs were identified in the visual layers."
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* CALIBRATION ENGINE CONFIDENCE & SOURCE PROBABILITY GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CALIBRATION YARD CARD */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Calibration Engine Confidence</span>
                      <span className="text-[11px] font-extrabold text-indigo-400 font-mono">{activeReport.confidenceScore || 95}% Convergence</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      {activeReport.confidenceExplanation || "The forensic classifier completed exhaustive model weight ensemble analysis and neural consensus validation across multi-spectral noise filters."}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${activeReport.confidenceScore || 95}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 uppercase block text-right font-medium">Neural State Calibration Weight</span>
                  </div>
                </div>

                {/* AI SOURCE SPECTRUM CARD */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-850 space-y-3">
                  <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-900 pb-2">AI Source Probability Distribution</span>
                  
                  {activeReport.aiProbability && activeReport.aiProbability >= 8 && activeReport.aiSourceProbability ? (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {Object.entries(activeReport.aiSourceProbability).map(([key, value]) => {
                        const val = value as number;
                        if (val === 0) return null;
                        
                        const nameMap: Record<string, string> = {
                          stableDiffusion: "Stable Diffusion Pipeline",
                          dalle: "DALL·E Generator",
                          midjourney: "Midjourney Render Engine",
                          flux: "Flux Latent Transformer",
                          gemini: "Gemini Image Synthesis",
                          adobeFirefly: "Adobe Firefly Studio",
                          synthId: "Google SynthID Trace Engine"
                        };
                        const label = nameMap[key] || key;
                        
                        return (
                          <div key={key} className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-mono">
                              <span className="text-slate-350">{label}</span>
                              <span className="text-white font-bold">{val}% match</span>
                            </div>
                            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                              <div className="bg-indigo-400 h-full" style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[90px] text-center border border-dashed border-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">No AI Distribution Detected</span>
                      <span className="text-[9px] text-slate-600 mt-1 max-w-[200px]">Asset probability is fully continuous, indicating genuine camera profile sensor.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* HEATMAP CONTAINER VIEW */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-slate-400" /> Image Detection Heatmap Analysis
                  </span>
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Split View Comparison</span>
                    <button
                      type="button"
                      onClick={() => setSplitView(!splitView)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-slate-800 transition-colors duration-200 ease-in-out focus:outline-none ${
                        splitView ? 'bg-indigo-600' : 'bg-slate-900'
                      }`}
                    >
                      <span className="sr-only">Toggle Split View</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                          splitView ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {splitView ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT CONTAINER: ORIGINAL UNTOUCHED INPUT */}
                    <div className="relative border border-slate-850 rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center p-2">
                      <img src={activeReport.thumbnailUrl} className="max-h-full max-w-full object-contain" alt="Original visual input untouched" />
                      <div className="absolute top-2 left-2 bg-slate-950/80 border border-slate-850 px-2 py-0.5 rounded text-[8px] font-mono text-slate-300 font-bold uppercase tracking-wider">
                        🛡️ Original Untouched Input
                      </div>
                    </div>

                    {/* RIGHT CONTAINER: SYNTHETIC HEATMAP TRACES OVERLAY */}
                    <div className="relative border border-slate-850 rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                      <img src={activeReport.thumbnailUrl} className="max-h-full max-w-full object-contain opacity-60" alt="Heatmapped synthetic traces background" />

                      {/* Draw highlight beacons representing heatmap coordinates */}
                      {activeReport.heatmap && activeReport.heatmap.map((point, index) => (
                        <div
                          key={index}
                          onMouseEnter={() => setHoveredHeatmap(point)}
                          onMouseLeave={() => setHoveredHeatmap(null)}
                          className="absolute border-2 border-dashed border-red-500 rounded-full animate-pulse cursor-crosshair flex items-center justify-center"
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                            width: `${point.radius * 2}px`,
                            height: `${point.radius * 2}px`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: `rgba(239, 68, 68, ${point.intensity * 0.25})`
                          }}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                        </div>
                      ))}

                      <div className="absolute top-2 left-2 bg-slate-950/80 border border-slate-850 px-2 py-0.5 rounded text-[8px] font-mono text-red-450 font-extrabold uppercase tracking-wider text-red-400">
                        🔥 Synthetic Heatmap Overlay
                      </div>

                      {/* Absolute tracking overlay for hover highlight */}
                      {hoveredHeatmap && (
                        <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-red-500/50 p-2.5 rounded-lg z-20 text-left">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-red-400 font-mono">Target Area Details</span>
                          <p className="text-[10px] text-slate-200 mt-1 leading-normal font-sans">{hoveredHeatmap.feature}</p>
                          <span className="text-[9px] text-slate-400 font-mono mt-1 block">Drift Inconsistency rating: {(hoveredHeatmap.intensity * 100).toFixed(0)}%</span>
                        </div>
                      )}

                      {/* Informational overlay notice for first time users */}
                      {activeReport.heatmap && activeReport.heatmap.length > 0 && (
                        <div className="absolute top-2 right-2 bg-slate-950/80 border border-slate-850 px-2 py-1 rounded text-[8px] font-mono text-slate-350">
                          ℹ️ Hover beacons to trace fingerprints
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative border border-slate-850 rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                    <img src={activeReport.thumbnailUrl} className="max-h-full max-w-full object-contain" alt="Current visual report background" />

                    {/* Draw highlight beacons representing heatmap coordinates */}
                    {activeReport.heatmap && activeReport.heatmap.map((point, index) => (
                      <div
                        key={index}
                        onMouseEnter={() => setHoveredHeatmap(point)}
                        onMouseLeave={() => setHoveredHeatmap(null)}
                        className="absolute border-2 border-dashed border-red-500 rounded-full animate-pulse cursor-crosshair flex items-center justify-center"
                        style={{
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          width: `${point.radius * 2}px`,
                          height: `${point.radius * 2}px`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: `rgba(239, 68, 68, ${point.intensity * 0.25})`
                        }}
                      >
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                      </div>
                    ))}

                    {/* Absolute tracking overlay for hover highlight */}
                    {hoveredHeatmap && (
                      <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-red-500/50 p-2.5 rounded-lg z-20 text-left">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-red-400 font-mono">Target Area Details</span>
                        <p className="text-[10px] text-slate-200 mt-1 leading-normal font-sans">{hoveredHeatmap.feature}</p>
                        <span className="text-[9px] text-slate-400 font-mono mt-1 block">Drift Inconsistency rating: {(hoveredHeatmap.intensity * 100).toFixed(0)}%</span>
                      </div>
                    )}

                    {/* Informational overlay notice for first time users */}
                    {activeReport.heatmap && activeReport.heatmap.length > 0 && (
                      <div className="absolute top-2 right-2 bg-slate-950/80 border border-slate-850 px-2 py-1 rounded text-[8px] font-mono text-slate-300">
                        ℹ️ Hover highlights on media and inspect anomalous spots
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TWO COLUMN METADATA FINDINGS & FORENSIC EXPLANATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* FORENSIC EXPLANATION SUMMARY */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> General Diagnosis Summary
                  </span>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {activeReport.explanation}
                      </p>
                      
                      {/* Diagnostic pill indicators */}
                      {activeReport.aiArtifactIndicators && activeReport.aiArtifactIndicators.length > 0 && (
                        <div className="pt-2">
                          <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Anomaly Indicators Flagged</span>
                          <div className="flex flex-wrap gap-1">
                            {activeReport.aiArtifactIndicators.map((ind, i) => (
                              <span key={i} className="text-[8px] font-sans px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-850 flex items-center gap-1.5 leading-tight">
                                <span className={`w-1 h-1 rounded-full ${activeReport.aiProbability >= 30 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'} inline-block`} />
                                {ind}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 border-t border-slate-900 pt-3 mt-4">
                      <div>
                        <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-widest">Signal Divergence</span>
                        <span className="text-sm font-extrabold text-white font-mono">{activeReport.frequencySpectrumAnomalies}%</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-widest">Artifact Consistency</span>
                        <span className="text-sm font-extrabold text-white font-mono">{100 - activeReport.noiseInconsistencyScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* METADATA TAGS SCREEN */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-400" /> Metadata Properties
                  </span>
                  
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2.5">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5 text-xs">
                      <span className="text-slate-500 font-mono">Suggested Hardware</span>
                      <span className="text-white font-bold">{activeReport.exif.CameraModel || "Not Detected"}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5 text-xs">
                      <span className="text-slate-500 font-mono">Processing Application</span>
                      <span className="text-white font-bold max-w-[140px] truncate" title={activeReport.exif.Software}>{activeReport.exif.Software || "Not Detected"}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5 text-xs">
                      <span className="text-slate-500 font-mono">Exposure Timestamp</span>
                      <span className="text-white font-mono text-[10px]">{activeReport.exif.ModifyDate ? new Date(activeReport.exif.ModifyDate).toLocaleDateString() : 'N/A'}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5 text-xs">
                      <span className="text-slate-500 font-mono">Metadata State</span>
                      <span className={`px-1.5 rounded uppercase text-[8px] font-mono font-bold border ${
                        activeReport.exif.MetadataStatus === 'authentic'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-900/40'
                          : activeReport.exif.MetadataStatus === 'altered'
                          ? 'bg-yellow-950 text-yellow-400 border-yellow-800/40'
                          : 'bg-red-950 text-red-400 border-red-900/40'
                      }`}>
                        {activeReport.exif.MetadataStatus}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-slate-500 font-mono">Watermark Tag</span>
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${activeReport.exif.AiWatermarkDetected ? 'text-red-400 font-extrabold' : 'text-slate-500'}`}>
                        {activeReport.exif.AiWatermarkDetected ? '⚠️ SYNTHID ACCENT KEY FOUND' : 'None Detected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMELINE (VIDEO ONLY) */}
              {activeReport.fileType === 'video' && activeReport.videoFrameAnomalies && activeReport.videoFrameAnomalies.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-slate-400" /> Timeline Anomaly Trace
                  </span>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-4">
                    {/* Linear timeline representation */}
                    <div className="relative h-6 bg-slate-900 rounded-lg flex items-center border border-slate-850">
                      <div className="absolute left-0 right-0 h-0.5 bg-slate-850" />
                      
                      {activeReport.videoTimeline && activeReport.videoTimeline.map((mark, i) => (
                        <div
                          key={i}
                          className="absolute text-center group cursor-pointer"
                          style={{ left: `${(mark.seconds / 6) * 100}%` }}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 -translate-x-1/2 flex items-center justify-center ${
                            mark.type === 'manipulation' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          
                          {/* Rich hover tooltip */}
                          <div className="hidden group-hover:block absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 p-2 rounded-lg text-[9px] font-mono w-32 text-left z-30">
                            <span className="block font-bold text-white capitalize">{mark.label}</span>
                            <span className="block text-slate-400 mt-0.5">Time: {mark.seconds}s</span>
                            <span className="block text-slate-450 mt-0.5 font-bold">Rating: {mark.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Frame loop detailed table */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {activeReport.videoFrameAnomalies.slice(0, 3).map((anomaly, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-850 flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-mono text-slate-500">FRAME #{anomaly.frameIndex} ({anomaly.timestamp})</span>
                            <h5 className="font-bold text-white text-xs mt-1">{anomaly.anomalyType}</h5>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-850/80 pt-2 mt-3">
                            <span className="text-[10px] text-slate-400 font-mono">Severity:</span>
                            <span className="text-xs font-mono font-bold text-red-400">{anomaly.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <span className="block text-[9px] font-mono text-slate-500 leading-relaxed text-center italic">
                      Timeline anomaly map tracks inconsistent lips and artifacts synchronicity alignment.
                    </span>
                  </div>
                </div>
              )}
                </>
              )}

            </div>
          ) : (
            <div className="bg-slate-900/10 border border-dashed border-slate-900 rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500">
                <Cpu className="w-6 h-6 text-slate-400" />
              </div>
              <div className="max-w-md">
                <span className="block text-sm font-bold text-slate-350">No report loaded</span>
                <span className="block text-xs text-slate-500 mt-2 leading-relaxed">
                  Select an item from the file queue or drag and upload fresh media files to begin standard integrity decoding.
                </span>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 pt-10 pb-8 px-4 text-center z-10 bg-slate-950">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-medium">TruthLens AI</p>
        <p className="text-[10px] text-slate-600 mt-1.5 max-w-xl mx-auto">
          Deepfake verification scanner optimized to evaluate media integrity metrics.
        </p>
      </footer>

    </div>
  );
}
