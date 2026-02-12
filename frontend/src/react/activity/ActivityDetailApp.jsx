import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Services from '../../lib/services/index.js';
import { LoadingSkeleton, GlassCard } from '../components/ui';
import { notify } from '../../lib/core/utils.js';
import { 
  normalizeStreams, 
  deriveMetricsFromStreams, 
  hasStreamData,
  parseTagsInput
} from './activityUtils';

// Sub-components
import ActivityHeader from './components/ActivityHeader';
import ActivityStats from './components/ActivityStats';
import ActivityMetrics from './components/ActivityMetrics';
import ActivityAnnotations from './components/ActivityAnnotations';
import AdvancedMetrics from './components/AdvancedMetrics';
import TimelineCharts from './components/TimelineCharts';
import PowerCurveChart from './components/PowerCurveChart';
import ZoneDistribution from './components/ZoneDistribution';
import ActivityMap from './components/ActivityMap';

const normalizeDistanceKm = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num > 1000 ? num / 1000 : num;
};

const ActivityDetailApp = ({ activityId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState(null);
  const [settings, setSettings] = useState(null);
  const [bestPowers, setBestPowers] = useState(null);
  const [streams, setStreams] = useState(null);
  const [advancedMetrics, setAdvancedMetrics] = useState(null);
  const [tagsInput, setTagsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [rpeInput, setRpeInput] = useState('');
  const [routeMetric, setRouteMetric] = useState('power');

  useEffect(() => {
    document.body.classList.add('page-activity');
    return () => document.body.classList.remove('page-activity');
  }, []);

  useEffect(() => {
    if (!activityId) {
      setError('No activity ID provided for activity detail view');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        Services.analytics.trackPageView('activity-detail', { activityId });
        const [activityData, settingsData, bestPowerData, streamData, advanced] = await Promise.all([
          Services.data.getActivity(activityId, { forceRefresh: true }),
          Services.data.getSettings(),
          Services.data.getBestPowerValues(),
          Services.data.getActivityStreams(activityId).catch(() => null),
          Services.data.getAdvancedMetrics(activityId).catch(() => null)
        ]);

        const normalizedActivity = {
          ...activityData,
          power_zones: Array.isArray(activityData?.power_zones) ? activityData.power_zones : [],
          hr_zones: Array.isArray(activityData?.hr_zones) ? activityData.hr_zones : [],
          tags: Array.isArray(activityData?.tags) ? activityData.tags : [],
          notes: activityData?.notes || '',
          rpe: activityData?.rpe ?? null
        };

        const normalizedStreams = normalizeStreams(streamData);
        const updatedActivity = deriveMetricsFromStreams(normalizedActivity, normalizedStreams, settingsData);

        setActivity(updatedActivity);
        setSettings(settingsData);
        setBestPowers(bestPowerData);
        setStreams(normalizedStreams);
        setAdvancedMetrics(advanced);
        setTagsInput(updatedActivity.tags.join(', '));
        setNotesInput(updatedActivity.notes || '');
        setRpeInput(updatedActivity.rpe ?? '');
      } catch (err) {
        Services.analytics.trackError('activity_detail_load', err?.message || 'unknown');
        setError(err?.message || 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activityId]);

  const hasPowerStream = hasStreamData(streams?.power);
  const hasHRStream = hasStreamData(streams?.heart_rate);
  const hasPowerCurve = Array.isArray(streams?.power_curve?.durations) && streams.power_curve.durations.length > 0;
  
  const timelineMaxSeconds = useMemo(() => {
    if (Array.isArray(streams?.time) && streams.time.length) {
      return streams.time[streams.time.length - 1];
    }
    if (Number.isFinite(activity?.moving_time)) return activity.moving_time;
    return null;
  }, [streams?.time, activity?.moving_time]);

  const handleSaveNotes = async () => {
    if (!activityId) return;
    const tags = parseTagsInput(tagsInput);
    const notes = notesInput || '';
    const rpeValue = rpeInput === '' ? null : Number(rpeInput);

    if (rpeValue !== null && (!Number.isFinite(rpeValue) || rpeValue < 1 || rpeValue > 10)) {
      notify('RPE must be between 1 and 10', 'warning');
      return;
    }

    try {
      const response = await Services.api.updateActivity(activityId, {
        tags,
        notes,
        rpe: rpeValue
      });
      const updated = response?.activity || {};
      setActivity((prev) => ({
        ...prev,
        notes: updated.notes ?? notes,
        rpe: updated.rpe ?? rpeValue,
        tags: updated.tags ?? tags
      }));
      notify('Activity notes updated', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to save notes', 'error');
    }
  };

  const handleRename = async () => {
    if (!activityId || !activity) return;
    const current = activity.name || '';
    const updated = window.prompt('Rename activity', current);
    if (updated === null) return;
    const trimmed = updated.trim();
    if (!trimmed) return;
    try {
      await Services.data.renameActivity(activityId, trimmed);
      setActivity((prev) => ({ ...prev, custom_name: trimmed, name: trimmed }));
      notify('Activity renamed', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to rename activity', 'error');
    }
  };

  const handleDelete = async () => {
    if (!activityId) return;
    if (!window.confirm('Are you sure you want to delete this activity? This cannot be undone.')) return;
    try {
      await Services.data.deleteActivity(activityId);
      notify('Activity deleted', 'success');
      window.location.hash = '#/activities';
    } catch (err) {
      notify(err?.message || 'Failed to delete activity', 'error');
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.hash = '#/activities';
  };

  const heroSummary = useMemo(() => {
    if (!activity) return { tss: '-', intensityFactor: '-', efficiencyFactor: '-' };
    return {
      tss: activity.tss ? Math.round(activity.tss) : '-',
      intensityFactor: activity.intensity_factor ? activity.intensity_factor.toFixed(2) : '-',
      efficiencyFactor: activity.efficiency_factor ? activity.efficiency_factor.toFixed(2) : '-'
    };
  }, [activity]);

  if (loading) return <LoadingSkeleton type="activity-detail" />;
  if (error) return <div className="activity-error-state">{error}</div>;
  if (!activity) return <div className="activity-error-state">Activity not found</div>;

  const distanceRaw = activity.distance
    ?? activity.total_distance
    ?? activity.totalDistance
    ?? activity.distance_km;
  const distanceValue = normalizeDistanceKm(distanceRaw);
  const distance = Number.isFinite(distanceValue) ? `${distanceValue.toFixed(1)} km` : '-';

  return (
    <div className="activity-detail-view container py-8">
      <div className="activity-breadcrumb">
        <button type="button" className="activity-breadcrumb-link" onClick={handleBack}>
          <ArrowLeft size={18} />
          Back
        </button>
      </div>
      <ActivityMap 
        activity={activity}
        streams={streams}
        settings={settings}
        routeMetric={routeMetric}
        setRouteMetric={setRouteMetric}
        hasPowerStream={hasPowerStream}
        hasHRStream={hasHRStream}
      />

      <ActivityHeader 
        activity={activity}
        heroSummary={heroSummary}
        onRename={handleRename}
      />

      <ActivityStats 
        activity={activity}
        distance={distance}
      />

      <div className="activity-main-grid mt-8">
        <GlassCard>
          <ActivityMetrics 
            activity={activity}
            heroSummary={heroSummary}
          />
        </GlassCard>

        <GlassCard>
          <ActivityAnnotations 
            tagsInput={tagsInput}
            setTagsInput={setTagsInput}
            rpeInput={rpeInput}
            setRpeInput={setRpeInput}
            notesInput={notesInput}
            setNotesInput={setNotesInput}
            onSave={handleSaveNotes}
          />
        </GlassCard>
      </div>

      <AdvancedMetrics advancedMetrics={advancedMetrics} />

      <TimelineCharts 
        streams={streams}
        timelineMaxSeconds={timelineMaxSeconds}
        hasPowerStream={hasPowerStream}
        hasHRStream={hasHRStream}
      />

      {hasPowerCurve && (
        <PowerCurveChart 
          streams={streams}
          timelineMaxSeconds={timelineMaxSeconds}
        />
      )}

      <ZoneDistribution 
        activity={activity}
        settings={settings}
      />

      <div className="activity-footer-actions mt-12 flex justify-center">
        <button className="btn btn--danger btn--ghost btn--sm" onClick={handleDelete}>
          <Trash2 size={16} className="mr-2" />
          Delete Activity
        </button>
      </div>
    </div>
  );
};

export default ActivityDetailApp;
