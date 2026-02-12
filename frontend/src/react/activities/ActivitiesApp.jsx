import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, XCircle, Bookmark, Save } from 'lucide-react';
import Services from '../../lib/services/index.js';
import { LoadingSkeleton } from '../components/ui';
import { notify } from '../../lib/core/utils.js';
import ActivityCard from './components/ActivityCard';

const DEFAULT_FILTERS = {
  sortBy: 'date',
  sortOrder: 'desc',
  search: '',
  tags: '',
  tssMin: '',
  tssMax: '',
  powerMin: '',
  powerMax: '',
  startDate: '',
  endDate: ''
};

const PRESET_STORAGE_KEY = 'training_dashboard_activity_presets';
const PAGE_SIZE = 20;

const loadPresets = () => {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[Activities] Failed to load presets', error);
    return [];
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDuration = (seconds) => {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const getActivityId = (activity) => {
  if (!activity) return null;
  return activity.id ?? activity.activity_id ?? activity.activityId ?? activity._id ?? null;
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const ActivitiesApp = () => {
  const [allActivities, setAllActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [currentPage, setCurrentPage] = useState(0);
  const [presets, setPresets] = useState(loadPresets());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    document.body.classList.add('page-activities');
    return () => document.body.classList.remove('page-activities');
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    setError('');
    try {
      Services.analytics.trackPageView('activities');
      const pageSize = 500;
      let page = 0;
      let all = [];
      while (true) {
        const batch = await Services.data.getActivities({
          limit: pageSize,
          skip: page * pageSize,
          forceRefresh: true
        });
        all = all.concat(batch || []);
        if (!batch || batch.length < pageSize) break;
        page += 1;
      }
      setAllActivities(all);
      setCurrentPage(0);
    } catch (err) {
      Services.analytics.trackError('activities_load', err.message);
      setError(err?.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleDelete = async (activityId) => {
    if (!window.confirm('Delete this activity forever?')) return;
    try {
      await Services.data.deleteActivity(activityId);
      setAllActivities((prev) => prev.filter((a) => getActivityId(a) !== activityId));
      notify('Activity deleted successfully', 'success');
    } catch (err) {
      notify(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleFilterChange = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setCurrentPage(0);
    setSelectedPreset('');
  };

  const filteredActivities = useMemo(() => {
    let result = [...allActivities];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((a) => (
        (a.custom_name || a.file_name || '').toLowerCase().includes(q)
      ));
    }

    if (filters.tags) {
      const q = filters.tags.toLowerCase().replace(/#/g, '').split(',').map((s) => s.trim()).filter(Boolean);
      if (q.length) {
        result = result.filter((a) => {
          const atags = (a.tags || []).map((t) => t.toLowerCase());
          return q.every((tag) => atags.includes(tag));
        });
      }
    }

    const tMin = parseNumber(filters.tssMin);
    const tMax = parseNumber(filters.tssMax);
    if (tMin !== null) result = result.filter((a) => (a.tss || 0) >= tMin);
    if (tMax !== null) result = result.filter((a) => (a.tss || 0) <= tMax);

    const pMin = parseNumber(filters.powerMin);
    const pMax = parseNumber(filters.powerMax);
    if (pMin !== null) result = result.filter((a) => (a.avg_power || 0) >= pMin);
    if (pMax !== null) result = result.filter((a) => (a.avg_power || 0) <= pMax);

    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      result = result.filter((a) => new Date(a.start_time).getTime() >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime() + 86400000;
      result = result.filter((a) => new Date(a.start_time).getTime() <= end);
    }

    result.sort((a, b) => {
      let valA, valB;
      if (filters.sortBy === 'power') {
        valA = a.avg_power || 0;
        valB = b.avg_power || 0;
      } else if (filters.sortBy === 'duration') {
        valA = a.duration || 0;
        valB = b.duration || 0;
      } else if (filters.sortBy === 'distance') {
        valA = a.distance || 0;
        valB = b.distance || 0;
      } else if (filters.sortBy === 'name') {
        valA = (a.custom_name || a.file_name || '').toLowerCase();
        valB = (b.custom_name || b.file_name || '').toLowerCase();
      } else {
        valA = new Date(a.start_time).getTime();
        valB = new Date(b.start_time).getTime();
      }

      if (valA < valB) return filters.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allActivities, filters]);

  const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const pageItems = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, currentPage]);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      notify('Please enter a name for the preset', 'warning');
      return;
    }
    const newPresets = [...presets, { name: presetName, filters: { ...filters } }];
    setPresets(newPresets);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(newPresets));
    setPresetName('');
    notify('Preset saved', 'success');
  };

  const handleApplyPreset = (event) => {
    const name = event.target.value;
    setSelectedPreset(name);
    if (!name) return;
    const preset = presets.find((p) => p.name === name);
    if (preset) {
      setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
      setCurrentPage(0);
    }
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedPreset('');
    setCurrentPage(0);
  };

  if (loading) {
    return (
      <div className="actx-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Activities</h1>
            <p className="page-description">Filter, inspect, and manage every ride in your history.</p>
          </div>
        </div>
        <LoadingSkeleton type="table" count={1} />
      </div>
    );
  }

  return (
    <div className="actx-shell">
      <header className="actx-hero page-header">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="page-title">Activities</h1>
          <p className="page-description">Filter, inspect, and manage every ride in your history.</p>
          <div className="page-header__meta">
            <span className="page-pill page-pill--accent">Total {allActivities.length}</span>
            <span className="page-pill page-pill--muted">Filtered {filteredActivities.length}</span>
            <span className="page-pill page-pill--muted">Page {currentPage + 1} / {pageCount}</span>
          </div>
        </motion.div>
      </header>

      <div className="actx-layout">
        <aside className="actx-filters">
          <div className="actx-filter-card">
            <div className="actx-filter-title">
              <Search size={14} />
              Search
            </div>
            <input
              type="text"
              value={filters.search}
              onChange={handleFilterChange('search')}
              placeholder="Ride name..."
              className="actx-input"
            />
            <div className="actx-field">
              <label htmlFor="actx-tags-input">Tags</label>
              <input
                id="actx-tags-input"
                type="text"
                value={filters.tags}
                onChange={handleFilterChange('tags')}
                placeholder="#interval, #race"
                className="actx-input"
              />
            </div>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">
              <ArrowUpDown size={14} />
              Sort
            </div>
            <div className="actx-row">
              <select className="actx-select" value={filters.sortBy} onChange={handleFilterChange('sortBy')}>
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="power">Power</option>
                <option value="duration">Duration</option>
                <option value="distance">Distance</option>
              </select>
              <select className="actx-select" value={filters.sortOrder} onChange={handleFilterChange('sortOrder')}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">
              <Filter size={14} />
              Filters
            </div>
            <div className="actx-field">
              <label>Date range</label>
              <div className="actx-row">
                <input type="date" className="actx-input" value={filters.startDate} onChange={handleFilterChange('startDate')} />
                <input type="date" className="actx-input" value={filters.endDate} onChange={handleFilterChange('endDate')} />
              </div>
            </div>
            <div className="actx-field">
              <label>TSS range</label>
              <div className="actx-row">
                <input type="number" className="actx-input" placeholder="Min" value={filters.tssMin} onChange={handleFilterChange('tssMin')} />
                <input type="number" className="actx-input" placeholder="Max" value={filters.tssMax} onChange={handleFilterChange('tssMax')} />
              </div>
            </div>
            <div className="actx-field">
              <label>Power range (W)</label>
              <div className="actx-row">
                <input type="number" className="actx-input" placeholder="Min" value={filters.powerMin} onChange={handleFilterChange('powerMin')} />
                <input type="number" className="actx-input" placeholder="Max" value={filters.powerMax} onChange={handleFilterChange('powerMax')} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="actx-btn actx-btn--ghost"
            >
              <XCircle size={14} />
              Reset filters
            </button>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">
              <Bookmark size={14} />
              Presets
            </div>
            <div className="actx-field">
              <label>Apply preset</label>
              <select className="actx-select" value={selectedPreset} onChange={handleApplyPreset}>
                <option value="">Select preset</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
            </div>
            <div className="actx-field">
              <label>Save current filters</label>
              <div className="actx-row">
                <input
                  type="text"
                  className="actx-input"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Preset name"
                />
                <button type="button" className="actx-btn actx-btn--primary" onClick={handleSavePreset}>
                  <Save size={14} />
                  Save
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="actx-results flex-1">
          <AnimatePresence mode="popLayout">
            {pageItems.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="actx-empty glass-card py-12 text-center"
              >
                <h3 className="text-xl font-bold mb-2">No activities found</h3>
                <p className="text-slate-400">Try adjusting your filters or clearing presets.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                className="actx-list space-y-3"
              >
                {pageItems.map((activity) => (
                  <ActivityCard
                    key={getActivityId(activity)}
                    activity={activity}
                    formatDate={formatDate}
                    formatDuration={formatDuration}
                    getActivityId={getActivityId}
                    onDelete={handleDelete}
                    onClick={() => {
                      const id = getActivityId(activity);
                      if (id) {
                        if (window.router) window.router.navigateTo(`activity/${id}`);
                        else window.location.hash = `#/activity/${id}`;
                      }
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {pageCount > 1 && (
            <div className="actx-pagination flex items-center justify-center gap-4 mt-8">
              <button
                className="p-2 glass-card hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-medium">Page {currentPage + 1} of {pageCount}</span>
              <button
                className="p-2 glass-card hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                type="button"
                disabled={currentPage + 1 >= pageCount}
                onClick={() => setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ActivitiesApp;
