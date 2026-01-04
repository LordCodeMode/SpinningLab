import React, { useEffect, useMemo, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import { notify } from '../../../static/js/core/utils.js';

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
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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

  useEffect(() => {
    if (typeof feather !== 'undefined') feather.replace();
  }, [loading, allActivities]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  const filteredActivities = useMemo(() => {
    let list = [...allActivities];

    const term = (filters.search || '').trim().toLowerCase();
    if (term) {
      list = list.filter((activity) => {
        const name = (activity.custom_name || activity.file_name || '').toLowerCase();
        return name.includes(term);
      });
    }

    const tagFilter = (filters.tags || '')
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);

    if (tagFilter.length) {
      list = list.filter((activity) => {
        const tags = Array.isArray(activity.tags) ? activity.tags.map((tag) => tag.toLowerCase()) : [];
        return tagFilter.some((tag) => tags.includes(tag));
      });
    }

    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;
    if (startDate || endDate) {
      list = list.filter((activity) => {
        if (!activity.start_time) return false;
        const activityDate = new Date(activity.start_time);
        if (startDate && activityDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (activityDate > endOfDay) return false;
        }
        return true;
      });
    }

    const tssMin = parseNumber(filters.tssMin);
    const tssMax = parseNumber(filters.tssMax);
    if (tssMin !== null) {
      list = list.filter((activity) => (activity.tss ?? 0) >= tssMin);
    }
    if (tssMax !== null) {
      list = list.filter((activity) => (activity.tss ?? 0) <= tssMax);
    }

    const powerMin = parseNumber(filters.powerMin);
    const powerMax = parseNumber(filters.powerMax);
    if (powerMin !== null) {
      list = list.filter((activity) => (activity.avg_power ?? 0) >= powerMin);
    }
    if (powerMax !== null) {
      list = list.filter((activity) => (activity.avg_power ?? 0) <= powerMax);
    }

    list.sort((a, b) => {
      let comparison = 0;
      const getName = (activity) => (activity.custom_name || activity.file_name || '').toLowerCase();
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.start_time || 0) - new Date(b.start_time || 0);
          break;
        case 'power':
          comparison = (a.avg_power || 0) - (b.avg_power || 0);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'distance':
          comparison = (a.distance || 0) - (b.distance || 0);
          break;
        case 'name':
          comparison = getName(a).localeCompare(getName(b));
          break;
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return list;
  }, [allActivities, filters]);

  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const pageItems = filteredActivities.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePresetApply = () => {
    const preset = presets.find((item) => item.name === selectedPreset);
    if (!preset) return;
    setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
    notify(`Applied preset "${preset.name}"`, 'success');
  };

  const handlePresetSave = () => {
    const name = presetName.trim();
    if (!name) {
      notify('Please enter a preset name', 'warning');
      return;
    }
    const next = [...presets.filter((item) => item.name !== name), { name, filters }];
    setPresets(next);
    setSelectedPreset(name);
    setPresetName('');
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
    notify(`Saved preset "${name}"`, 'success');
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedPreset('');
  };

  const handleDelete = async (activityId) => {
    if (!activityId) return;
    const confirmed = window.confirm('Delete this activity? This cannot be undone.');
    if (!confirmed) return;
    try {
      await Services.data.deleteActivity(activityId);
      notify('Activity deleted', 'success');
      await loadActivities();
    } catch (err) {
      notify(err.message || 'Failed to delete activity', 'error');
    }
  };

  if (loading) {
    return (
      <div className="actx-shell">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'table', count: 1 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="actx-shell">
        <div className="actx-empty">
          <h3>Failed to Load Activities</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="actx-shell">
      <header className="actx-hero">
        <div className="actx-hero__eyebrow">Training archive</div>
        <h1>Activities</h1>
        <p>Filter, inspect, and manage every ride in your history with a cleaner, faster workflow.</p>
        <div className="actx-hero__stats">
          <div className="actx-hero__chip">Total {allActivities.length}</div>
          <div className="actx-hero__chip">Filtered {filteredActivities.length}</div>
          <div className="actx-hero__chip">Page {currentPage + 1} / {pageCount}</div>
        </div>
      </header>

      <div className="actx-layout">
        <aside className="actx-filters">
          <div className="actx-filter-card">
            <div className="actx-filter-title">Quick filters</div>
            <label className="actx-field">
              <span>Search</span>
              <input
                type="text"
                value={filters.search}
                onChange={handleFilterChange('search')}
                placeholder="Search by name"
                className="actx-input"
              />
            </label>
            <label className="actx-field">
              <span>Tags</span>
              <input
                type="text"
                value={filters.tags}
                onChange={handleFilterChange('tags')}
                placeholder="#interval, #race"
                className="actx-input"
              />
            </label>
            <div className="actx-field">
              <span>Sort</span>
              <div className="actx-row">
                <select className="actx-select" value={filters.sortBy} onChange={handleFilterChange('sortBy')}>
                  <option value="date">Date</option>
                  <option value="power">Avg Power</option>
                  <option value="duration">Duration</option>
                  <option value="distance">Distance</option>
                  <option value="name">Name</option>
                </select>
                <select className="actx-select" value={filters.sortOrder} onChange={handleFilterChange('sortOrder')}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">Date range</div>
            <label className="actx-field">
              <span>Start</span>
              <input type="date" className="actx-input" value={filters.startDate} onChange={handleFilterChange('startDate')} />
            </label>
            <label className="actx-field">
              <span>End</span>
              <input type="date" className="actx-input" value={filters.endDate} onChange={handleFilterChange('endDate')} />
            </label>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">Performance filters</div>
            <div className="actx-row">
              <label className="actx-field">
                <span>TSS min</span>
                <input type="number" className="actx-input" value={filters.tssMin} onChange={handleFilterChange('tssMin')} />
              </label>
              <label className="actx-field">
                <span>TSS max</span>
                <input type="number" className="actx-input" value={filters.tssMax} onChange={handleFilterChange('tssMax')} />
              </label>
            </div>
            <div className="actx-row">
              <label className="actx-field">
                <span>Power min</span>
                <input type="number" className="actx-input" value={filters.powerMin} onChange={handleFilterChange('powerMin')} />
              </label>
              <label className="actx-field">
                <span>Power max</span>
                <input type="number" className="actx-input" value={filters.powerMax} onChange={handleFilterChange('powerMax')} />
              </label>
            </div>
          </div>

          <div className="actx-filter-card">
            <div className="actx-filter-title">Presets</div>
            <div className="actx-row">
              <select className="actx-select" value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}>
                <option value="">Select preset</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
              <button type="button" className="actx-btn actx-btn--secondary" onClick={handlePresetApply}>
                Apply
              </button>
            </div>
            <div className="actx-row">
              <input
                type="text"
                className="actx-input"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Save preset as..."
              />
              <button type="button" className="actx-btn actx-btn--primary" onClick={handlePresetSave}>
                Save
              </button>
              <button type="button" className="actx-btn actx-btn--ghost" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </aside>

        <section className="actx-results">
          {pageItems.length === 0 ? (
            <div className="actx-empty">
              <h3>No activities found</h3>
              <p>Try adjusting your filters or clearing presets.</p>
            </div>
          ) : (
            <div className="actx-list">
              {pageItems.map((activity) => {
                const activityId = getActivityId(activity);
                const displayName = activity.custom_name || activity.file_name || 'Untitled Ride';
                const tags = Array.isArray(activity.tags) ? activity.tags : [];
                const navigateTo = activityId ? `activity/${activityId}` : null;

                return (
                  <article
                    key={activityId || `${displayName}-${activity.start_time}`}
                    className={`actx-card ${activityId ? 'actx-card--clickable' : ''}`}
                    onClick={() => {
                      if (!navigateTo) return;
                      if (window.router) {
                        window.router.navigateTo(navigateTo);
                      } else {
                        window.location.hash = `#/${navigateTo}`;
                      }
                    }}
                  >
                    <div className="actx-card-left">
                      <div className="actx-card-title">{displayName}</div>
                      <div className="actx-card-sub">
                        {formatDate(activity.start_time)}
                        <span className="actx-sep">|</span>
                        {formatDuration(activity.duration)}
                        <span className="actx-sep">|</span>
                        {activity.distance ? `${activity.distance.toFixed(1)} km` : '-'}
                      </div>
                      <div className="actx-tags">
                        {tags.length ? (
                          tags.map((tag) => (
                            <span key={tag} className="actx-tag">#{tag}</span>
                          ))
                        ) : (
                          <span className="actx-tag actx-tag--muted">No tags</span>
                        )}
                      </div>
                    </div>

                    <div className="actx-card-metrics">
                      <div className="actx-metric">
                        <span>Avg</span>
                        <strong>{activity.avg_power ? `${Math.round(activity.avg_power)}W` : '-'}</strong>
                      </div>
                      <div className="actx-metric">
                        <span>NP</span>
                        <strong>{activity.normalized_power ? `${Math.round(activity.normalized_power)}W` : '-'}</strong>
                      </div>
                      <div className="actx-metric">
                        <span>TSS</span>
                        <strong>{activity.tss ? Math.round(activity.tss) : '-'}</strong>
                      </div>
                    </div>

                    <div className="actx-card-actions">
                      <button
                        type="button"
                        className="actx-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(activityId);
                        }}
                      >
                        <i data-feather="trash-2"></i>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {pageCount > 1 && (
            <div className="actx-pagination">
              <button
                className="actx-btn actx-btn--secondary"
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </button>
              <span className="actx-page-indicator">Page {currentPage + 1} of {pageCount}</span>
              <button
                className="actx-btn actx-btn--secondary"
                type="button"
                disabled={currentPage + 1 >= pageCount}
                onClick={() => setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ActivitiesApp;
