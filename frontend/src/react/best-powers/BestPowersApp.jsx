import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/best-powers/config.js';

const DEFAULT_WEIGHT = 75;

const DURATION_SEGMENTS = [
  {
    key: 'max_5sec_power',
    label: '5s',
    seconds: 5,
    systemId: 'sprint',
    energySystem: 'Sprint Launch',
    description: 'Explosive neuromuscular effort for jump power.',
    icon: 'zap',
  },
  {
    key: 'max_1min_power',
    label: '1m',
    seconds: 60,
    systemId: 'anaerobic',
    energySystem: 'Anaerobic Punch',
    description: 'Repeated surges for steep ramps or attacks.',
    icon: 'activity',
  },
  {
    key: 'max_5min_power',
    label: '5m',
    seconds: 300,
    systemId: 'vo2max',
    energySystem: 'VO2 Max Engine',
    description: 'Measures your aerobic ceiling for decisive climbs.',
    icon: 'triangle',
  },
  {
    key: 'max_20min_power',
    label: '20m',
    seconds: 1200,
    systemId: 'threshold',
    energySystem: 'Threshold Grind',
    description: 'Time-trial capability and FTP proxy.',
    icon: 'trending-up',
  },
  {
    key: 'max_60min_power',
    label: '60m',
    seconds: 3600,
    systemId: 'endurance',
    energySystem: 'Endurance Diesel',
    description: 'Sustainable aerobic durability for stage racing.',
    icon: 'layers',
  },
];

const BENCHMARK_LEVELS = [
  {
    id: 'worldTour',
    label: 'WorldTour Pro',
    short: 'WT',
    rank: 0,
    className: 'bp-badge--worldtour',
    values: {
      max_5sec_power: 22.0,
      max_1min_power: 12.5,
      max_5min_power: 7.2,
      max_20min_power: 6.4,
      max_60min_power: 5.6,
    },
  },
  {
    id: 'pro',
    label: 'Continental Pro',
    short: 'Pro',
    rank: 1,
    className: 'bp-badge--pro',
    values: {
      max_5sec_power: 18.5,
      max_1min_power: 11.0,
      max_5min_power: 6.5,
      max_20min_power: 5.8,
      max_60min_power: 5.1,
    },
  },
  {
    id: 'cat1',
    label: 'Cat 1 / Elite Amateur',
    short: 'Cat1',
    rank: 2,
    className: 'bp-badge--cat1',
    values: {
      max_5sec_power: 16.0,
      max_1min_power: 9.5,
      max_5min_power: 5.6,
      max_20min_power: 5.0,
      max_60min_power: 4.4,
    },
  },
  {
    id: 'amateur',
    label: 'Competitive Amateur',
    short: 'Am',
    rank: 3,
    className: 'bp-badge--amateur',
    values: {
      max_5sec_power: 13.0,
      max_1min_power: 7.8,
      max_5min_power: 4.7,
      max_20min_power: 4.1,
      max_60min_power: 3.6,
    },
  },
  {
    id: 'club',
    label: 'Developing Rider',
    short: 'Dev',
    rank: 4,
    className: 'bp-badge--club',
    values: {
      max_5sec_power: 10.0,
      max_1min_power: 6.0,
      max_5min_power: 3.8,
      max_20min_power: 3.2,
      max_60min_power: 2.8,
    },
  },
];

const NO_DATA_LEVEL = {
  id: 'none',
  label: 'Record Needed',
  short: '—',
  rank: 999,
  className: 'bp-badge--muted',
};

const PROFILE_ARCHETYPES = {
  sprint: {
    title: 'Explosive Sprinter',
    subtitle: 'Fast-twitch dominance',
    focus: 'Sharpen neuromuscular power with sprint drills and strength work.',
  },
  anaerobic: {
    title: 'Punchy Climber',
    subtitle: 'Anaerobic repeatability',
    focus: 'Blend 30–60s surges with VO2 micro intervals to keep the sting.',
  },
  vo2max: {
    title: 'VO2 Max Engine',
    subtitle: 'High aerobic ceiling',
    focus: 'Regular VO2 blocks and race simulations keep the top-end primed.',
  },
  threshold: {
    title: 'Time Trial Specialist',
    subtitle: 'Relentless threshold power',
    focus: 'Sweet spot over/unders and long steady efforts push FTP higher.',
  },
  endurance: {
    title: 'Endurance Diesel',
    subtitle: 'Superior aerobic durability',
    focus: 'Back-to-back endurance and tempo rides reinforce late-race stamina.',
  },
};

const RANGE_OPTIONS = [
  { id: '90', label: '90d' },
  { id: '240', label: '240d' },
  { id: '365', label: '1y' },
  { id: 'all', label: 'All Time' },
];

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseWeight = (value) => {
  const parsed = toNumber(value);
  return parsed && parsed > 0 ? parsed : null;
};

const formatPowerValue = (value, { usingWkg }) => {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (usingWkg) return `${value.toFixed(2)} W/kg`;
  if (value >= 1000) return `${Math.round(value)} W`;
  if (value >= 100) return `${value.toFixed(0)} W`;
  return `${value.toFixed(1)} W`;
};

const formatTooltipValue = (value, { usingWkg }) => {
  if (!Number.isFinite(value)) return '—';
  if (usingWkg) return `${value.toFixed(2)} W/kg`;
  return `${Math.round(value)} W`;
};

const formatAxisValue = (value, { usingWkg }) => {
  if (!Number.isFinite(value)) return '';
  if (usingWkg) return value.toFixed(1);
  if (Math.abs(value) >= 1000) return Math.round(value);
  return value.toFixed(0);
};

const formatDelta = (delta, { usingWkg }) => {
  if (!Number.isFinite(delta)) return '';
  const sign = delta > 0 ? '+' : '';
  if (usingWkg) return `${sign}${delta.toFixed(2)} W/kg`;
  if (Math.abs(delta) >= 10) return `${sign}${Math.round(delta)} W`;
  return `${sign}${delta.toFixed(1)} W`;
};

const getRangeParams = (rangeId) => {
  switch (rangeId) {
    case '90':
      return { days: 90 };
    case '240':
      return { days: 240 };
    case '365':
      return { days: 365 };
    case 'all':
    default:
      return {};
  }
};

const determineLevel = (measurementValue, benchmarks) => {
  if (!Number.isFinite(measurementValue) || measurementValue <= 0) {
    return NO_DATA_LEVEL;
  }
  const ordered = [...benchmarks].sort((a, b) => a.rank - b.rank);
  const matched = ordered.find((level) => measurementValue >= level.value);
  return matched || ordered[ordered.length - 1] || NO_DATA_LEVEL;
};

const determineNextLevel = (measurementValue, benchmarks, currentLevel) => {
  if (!Number.isFinite(measurementValue) || measurementValue <= 0) return null;
  const ordered = [...benchmarks].sort((a, b) => a.rank - b.rank);
  const currentIndex = ordered.findIndex((level) => level.id === currentLevel.id);
  if (currentIndex <= 0) return null;
  const next = ordered[currentIndex - 1];
  return {
    ...next,
    delta: next.value - measurementValue,
  };
};

const prepareDurationData = (data, { weight, usingWkg }) => {
  if (!data) return [];

  const defaultWeight = weight || DEFAULT_WEIGHT;

  return DURATION_SEGMENTS.map((segment) => {
    const rawValue = toNumber(data?.[segment.key]);
    const hasValue = Number.isFinite(rawValue) && rawValue > 0;
    const absoluteValue = hasValue ? rawValue : null;
    const valueWkg = hasValue
      ? (usingWkg ? rawValue / weight : rawValue / defaultWeight)
      : null;

    const measurementValue = usingWkg ? valueWkg : absoluteValue;
    const measurementUnit = usingWkg ? 'W/kg' : 'Watts';

    const benchmarks = BENCHMARK_LEVELS.map((level) => {
      const referenceWkg = level.values[segment.key];
      const referenceValue = usingWkg ? referenceWkg : referenceWkg * (weight || defaultWeight);
      const percent = hasValue && referenceValue > 0
        ? Math.round((measurementValue / referenceValue) * 100)
        : 0;
      const worldTourWkg = BENCHMARK_LEVELS[0].values[segment.key];
      const valueRatio = worldTourWkg > 0 ? referenceWkg / worldTourWkg : 0;

      return {
        ...level,
        value: referenceValue,
        percent,
        valueRatio,
        formattedValue: formatPowerValue(referenceValue, { usingWkg }),
        measurementUnit,
      };
    });

    const benchmarksById = benchmarks.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    const level = determineLevel(measurementValue, benchmarks);
    const nextLevel = determineNextLevel(measurementValue, benchmarks, level);

    return {
      ...segment,
      key: segment.key,
      hasValue,
      value: absoluteValue,
      valueWkg,
      measurementValue,
      measurementUnit,
      formattedValue: formatPowerValue(measurementValue, { usingWkg }),
      percentWorldTour: benchmarksById.worldTour?.percent || 0,
      benchmarks,
      benchmarksById,
      level,
      nextLevel,
      usingWkg,
    };
  });
};

const buildProfile = (durationData) => {
  const validDurations = durationData.filter((item) => item.hasValue);
  if (!validDurations.length) {
    return {
      title: 'Power profile unavailable',
      subtitle: 'Upload more power-enabled rides',
      description: 'Once we detect personal records across key durations, we will map out your strengths and opportunities.',
      focus: 'Log rides with a power meter to unlock tailored recommendations.',
      averagePercent: 0,
      primarySystem: '—',
      primaryDurationLabel: '',
      nextMilestone: '—',
      nextMilestoneDetail: '',
      topDurations: [],
    };
  }

  const sortedByLevel = [...validDurations].sort((a, b) => {
    if (a.level.rank === b.level.rank) {
      return (b.percentWorldTour || 0) - (a.percentWorldTour || 0);
    }
    return a.level.rank - b.level.rank;
  });

  const strongest = sortedByLevel[0];
  const weakest = [...validDurations].sort((a, b) => (a.percentWorldTour || 0) - (b.percentWorldTour || 0))[0];

  const archetype = PROFILE_ARCHETYPES[strongest.systemId] || PROFILE_ARCHETYPES.threshold;

  const averagePercent = Math.round(
    validDurations.reduce((sum, item) => sum + (item.percentWorldTour || 0), 0) / validDurations.length
  );

  const nextLevel = weakest.nextLevel;

  return {
    ...archetype,
    description: `Your power signature skews toward ${archetype.subtitle.toLowerCase()}. Keep building on ${strongest.energySystem.toLowerCase()} while shoring up ${weakest.energySystem.toLowerCase()}.`,
    averagePercent,
    primarySystem: strongest.energySystem,
    primaryDurationLabel: `${strongest.formattedValue} (${strongest.level?.label || '—'})`,
    nextMilestone: nextLevel ? nextLevel.label : 'Maintain peak shape',
    nextMilestoneDetail: nextLevel
      ? `${formatDelta(nextLevel.value - weakest.measurementValue, { usingWkg: weakest.usingWkg })} to improve your ${weakest.label} record`
      : 'You are already matching the top benchmark – focus on maintaining consistency.',
    topDurations: sortedByLevel.slice(0, 3),
  };
};

const buildInsights = (durationData, profile, { usingWkg, weight }) => {
  const insights = [];
  const validDurations = durationData.filter((item) => item.hasValue);

  if (!validDurations.length) {
    if (!usingWkg) {
      insights.push({
        title: 'Log your weight',
        body: 'Adding your body mass in settings unlocks W/kg comparisons, climb readiness, and more precise insights.',
        badge: 'Setup Tip',
        badgeClass: 'bp-badge--muted',
      });
    }
    return insights;
  }

  const strongest = profile.topDurations?.[0] || validDurations[0];
  insights.push({
    title: `${strongest.energySystem} Strength`,
    body: `Your ${strongest.label} record sits at ${strongest.formattedValue}, ranking ${strongest.level.label} (${strongest.percentWorldTour}% of WorldTour). Lean into this advantage by scheduling workouts that reinforce it.`,
    badge: strongest.level.label,
    badgeClass: strongest.level.className,
  });

  const weakest = [...validDurations].sort((a, b) => (a.percentWorldTour || 0) - (b.percentWorldTour || 0))[0];
  if (weakest) {
    const nextText = weakest.nextLevel
      ? `${formatDelta(weakest.nextLevel.value - weakest.measurementValue, { usingWkg })} to reach ${weakest.nextLevel.label}`
      : 'Maintain consistency to keep pushing the entire curve upward.';

    insights.push({
      title: `${weakest.energySystem} Opportunity`,
      body: `Your ${weakest.label} record is currently ${weakest.level.label} (${weakest.formattedValue}). ${nextText}`,
      badge: 'Next Goal',
      badgeClass: 'bp-badge--warning',
    });
  }

  const averagePercent = Math.round(
    validDurations.reduce((sum, item) => sum + (item.percentWorldTour || 0), 0) / validDurations.length
  );

  const weightMessage = usingWkg
    ? `Benchmarks normalised at ${weight.toFixed(1)} kg.`
    : 'Add your weight to normalise power-to-weight comparisons.';

  insights.push({
    title: 'Benchmark Summary',
    body: `On average you are at ${averagePercent}% of WorldTour and ${Math.round(averagePercent * 1.12)}% of elite amateur benchmarks. Keep pushing the weaker durations to lift this overall score.`,
    badge: `${averagePercent}% of WT`,
    badgeClass: 'bp-badge--info',
    footer: weightMessage,
  });

  return insights;
};

export default function BestPowersApp() {
  const radarRef = useRef(null);
  const powerRef = useRef(null);
  const radarChartRef = useRef(null);
  const powerChartRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [currentRange, setCurrentRange] = useState('all');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    Services.analytics.trackPageView('best-powers');
  }, []);

  const fetchData = useCallback(async (rangeId) => {
    const params = getRangeParams(rangeId);
    const [bestPowerValues, userSettings] = await Promise.all([
      Services.data.getBestPowerValues({ ...params, forceRefresh: false }),
      Services.data.getSettings(),
    ]);
    setData(bestPowerValues);
    setSettings(userSettings);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (hasLoaded) {
          setIsTransitioning(true);
        }
        setLoading(true);
        setError(null);
        await fetchData(currentRange);
      } catch (err) {
        console.error('[BestPowersReact] load failed:', err);
        Services.analytics.trackError('best_powers_load', err.message);
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
        if (isMounted) {
          setIsTransitioning(false);
          setHasLoaded(true);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [currentRange, fetchData, hasLoaded]);

  const weight = useMemo(() => parseWeight(settings?.weight), [settings]);
  const usingWkg = useMemo(() => Number.isFinite(weight) && weight > 0, [weight]);

  const durationData = useMemo(
    () => prepareDurationData(data, { weight, usingWkg }),
    [data, weight, usingWkg]
  );

  const profile = useMemo(() => buildProfile(durationData), [durationData]);
  const insights = useMemo(() => buildInsights(durationData, profile, { usingWkg, weight }), [durationData, profile, usingWkg, weight]);

  useEffect(() => {
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }, [durationData, insights, profile]);

  useEffect(() => {
    const canvas = radarRef.current;
    const validDurations = durationData.filter((item) => item.hasValue);
    if (!canvas || !validDurations.length || typeof Chart === 'undefined') {
      if (radarChartRef.current) {
        radarChartRef.current.destroy();
        radarChartRef.current = null;
      }
      return;
    }

    if (radarChartRef.current) {
      radarChartRef.current.destroy();
    }

    const labels = validDurations.map((d) => d.energySystem);
    const userValues = validDurations.map((d) => d.percentWorldTour);
    const wtValues = validDurations.map(() => 100);

    radarChartRef.current = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Your Profile',
            data: userValues,
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderColor: '#38bdf8',
            borderWidth: 2.5,
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'WorldTour Standard',
            data: wtValues,
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
            borderColor: '#1d4ed8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: '#1d4ed8',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.r}%`,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 120,
            ticks: {
              stepSize: 20,
              font: { size: 11 },
              color: '#94a3b8',
              backdropColor: 'transparent',
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
              lineWidth: 1,
            },
            pointLabels: {
              font: { size: 12, weight: '600' },
              color: '#475569',
            },
          },
        },
      },
    });

    return () => {
      if (radarChartRef.current) {
        radarChartRef.current.destroy();
        radarChartRef.current = null;
      }
    };
  }, [durationData]);

  useEffect(() => {
    const canvas = powerRef.current;
    const validDurations = durationData.filter((item) => item.hasValue);
    if (!canvas || !validDurations.length || typeof Chart === 'undefined') {
      if (powerChartRef.current) {
        powerChartRef.current.destroy();
        powerChartRef.current = null;
      }
      return;
    }

    if (powerChartRef.current) {
      powerChartRef.current.destroy();
    }

    const labels = validDurations.map((d) => d.label);
    const userData = validDurations.map((d) => d.measurementValue);

    const datasets = [
      {
        label: 'Your Power',
        data: userData,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true,
      },
    ];

    const benchmarkColors = {
      worldTour: { border: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.08)' },
      pro: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)' },
      cat1: { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' },
    };

    ['worldTour', 'pro', 'cat1'].forEach((levelId) => {
      const levelData = validDurations.map((d) => {
        const benchmark = d.benchmarks.find((b) => b.id === levelId);
        return benchmark ? benchmark.value : null;
      });

      datasets.push({
        label: BENCHMARK_LEVELS.find((l) => l.id === levelId)?.label || levelId,
        data: levelData,
        borderColor: benchmarkColors[levelId].border,
        backgroundColor: benchmarkColors[levelId].bg,
        borderWidth: 2,
        borderDash: [5, 3],
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: false,
      });
    });

    powerChartRef.current = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              font: { size: 12, weight: '600' },
              color: '#475569',
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatTooltipValue(context.parsed.y, { usingWkg })}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: '600' }, color: '#64748b' },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.1)', lineWidth: 1 },
            ticks: {
              font: { size: 11 },
              color: '#94a3b8',
              callback: (value) => formatAxisValue(value, { usingWkg }),
            },
            title: {
              display: true,
              text: usingWkg ? 'W/kg' : 'Watts',
              font: { size: 12, weight: '600' },
              color: '#64748b',
            },
          },
        },
      },
    });

    return () => {
      if (powerChartRef.current) {
        powerChartRef.current.destroy();
        powerChartRef.current = null;
      }
    };
  }, [durationData, usingWkg]);

  useEffect(() => {
    return () => {
      if (radarChartRef.current) radarChartRef.current.destroy();
      if (powerChartRef.current) powerChartRef.current.destroy();
      radarChartRef.current = null;
      powerChartRef.current = null;
    };
  }, []);

  if (!hasLoaded && loading) {
    return (
      <div className="bp-react-shell">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'metric', count: 6 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bp-react-shell">
        <div className="bp-react-empty">
          <h3>Failed to load best powers</h3>
          <p>{error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const highlightDurations = profile.topDurations || [];
  const radarAvailable = durationData.some((item) => item.hasValue);
  const validDurations = durationData.filter((item) => item.hasValue);
  const milestoneDurations = durationData.filter((item) => item.hasValue && item.nextLevel);
  const rangeLabel = RANGE_OPTIONS.find((option) => option.id === currentRange)?.label || 'All Time';

  return (
    <div className={`bp-react-shell ${isTransitioning ? 'is-loading' : ''}`}>
      <div className={`bp-react-overlay ${isTransitioning ? 'is-active' : ''}`} aria-hidden="true"></div>
      <header className="bp-react-header">
        <div className="bp-react-header__title">
          <span className="bp-react-kicker">Performance Atlas</span>
          <h1>Best Powers</h1>
          <p>Peak output snapshots across sprint, aerobic, and endurance systems.</p>
          <div className="bp-react-title-underline" aria-hidden="true"></div>
        </div>
        <div className="bp-react-header__controls">
          <div className="bp-react-range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`bp-react-range-btn ${currentRange === option.id ? 'is-active' : ''}`}
                onClick={() => setCurrentRange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="bp-react-header__meta">
            <span className="bp-react-pill">{rangeLabel} view</span>
            <span className="bp-react-pill bp-react-pill--ghost">
              {usingWkg ? `${weight.toFixed(1)} kg` : 'Absolute watts'}
            </span>
          </div>
        </div>
      </header>

      <section className="bp-react-hero">
        <div className="bp-react-card bp-react-profile">
          <div className="bp-react-profile__meta">
            <span className="bp-react-chip">
              <i data-feather="activity"></i>
              Power Profile
            </span>
            <span className="bp-react-chip bp-react-chip--accent">{profile.primarySystem}</span>
          </div>
          <h2>{profile.title}</h2>
          <p className="bp-react-profile__subtitle">{profile.subtitle}</p>
          <p className="bp-react-profile__body">{profile.description}</p>
          <div className="bp-react-focus">
            <span>Training focus</span>
            <strong>{profile.focus}</strong>
          </div>
          <div className="bp-react-stat-grid">
            <div className="bp-react-stat-card">
              <span>Average vs WT</span>
              <strong>{profile.averagePercent}%</strong>
              <small>Across all durations</small>
            </div>
            <div className="bp-react-stat-card">
              <span>Strongest system</span>
              <strong>{profile.primarySystem}</strong>
              <small>{profile.primaryDurationLabel}</small>
            </div>
            <div className="bp-react-stat-card">
              <span>Next milestone</span>
              <strong>{profile.nextMilestone}</strong>
              <small>{profile.nextMilestoneDetail}</small>
            </div>
          </div>
          <div className="bp-react-highlights">
            {highlightDurations.length ? (
              highlightDurations.map((duration) => (
                <div className="bp-react-highlight" key={duration.key}>
                  <span>{duration.label}</span>
                  <strong>{duration.formattedValue}</strong>
                  <small>{duration.percentWorldTour}% of WT</small>
                </div>
              ))
            ) : (
              <div className="bp-react-highlight bp-react-highlight--empty">
                No power records yet
              </div>
            )}
          </div>
        </div>

        <div className="bp-react-card bp-react-radar">
          <div className="bp-react-card__header">
            <div>
              <h3>System Balance</h3>
              <p>Compare your strengths to WorldTour standards.</p>
            </div>
            <span className="bp-react-tag">Radar</span>
          </div>
          <div className="bp-react-radar__body">
            {radarAvailable ? (
              <canvas ref={radarRef} aria-label="Power profile radar"></canvas>
            ) : (
              <div className="bp-react-empty">
                <i data-feather="pie-chart"></i>
                <p>Radar visualization requires at least one power record.</p>
              </div>
            )}
          </div>
          {radarAvailable ? (
            <div className="bp-react-radar__legend">
              <span><i className="bp-react-dot bp-react-dot--primary"></i>Your profile</span>
              <span><i className="bp-react-dot bp-react-dot--secondary"></i>WorldTour</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bp-react-section">
        <header className="bp-react-section__header">
          <div>
            <h2>Performance Metrics</h2>
            <p>Your peak power output across key durations.</p>
          </div>
        </header>
        <div className="bp-react-metric-grid">
          {durationData.map((duration) => {
            const badge = duration.hasValue ? (
              <span className={`bp-badge ${duration.level.className}`}>{duration.level.short}</span>
            ) : null;
            const percent = Math.max(0, Math.min(100, duration.percentWorldTour || 0));

            return (
              <article
                className={`bp-react-metric-card ${duration.hasValue ? '' : 'is-empty'}`}
                key={duration.key}
              >
                <header>
                  <div className="bp-react-metric-label">
                    <i data-feather={duration.icon}></i>
                    <div>
                      <span>{duration.label}</span>
                      <small>{duration.energySystem}</small>
                    </div>
                  </div>
                  {badge}
                </header>
                {duration.hasValue ? (
                  <>
                    <div className="bp-react-metric-value">{duration.formattedValue}</div>
                    <div className="bp-react-metric-bar">
                      <div className="bp-react-metric-fill" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div className="bp-react-metric-meta">
                      <span>{duration.percentWorldTour}% of WT</span>
                      <span>{duration.level.label}</span>
                    </div>
                    <p>{duration.description}</p>
                  </>
                ) : (
                  <>
                    <div className="bp-react-metric-empty">No record yet</div>
                    <p>{duration.description}</p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="bp-react-section">
        <header className="bp-react-section__header">
          <div>
            <h2>Benchmark Analysis</h2>
            <p>Compare your power profile against competitive standards.</p>
          </div>
        </header>
        {validDurations.length ? (
          <div className="bp-react-comparison-grid">
            <div className="bp-react-card bp-react-chart-card">
              <div className="bp-react-card__header">
                <div>
                  <h3>Power Curve vs Benchmarks</h3>
                  <p>Track your profile against elite standards.</p>
                </div>
                <span className="bp-react-tag">Interactive</span>
              </div>
              <div className="bp-react-chart-body">
                <canvas ref={powerRef}></canvas>
              </div>
            </div>
            <div className="bp-react-card bp-react-detail-card">
              <div className="bp-react-card__header">
                <div>
                  <h3>Detailed Comparison</h3>
                  <p>See how each duration stacks up.</p>
                </div>
              </div>
              <div className="bp-react-detail-list">
                {validDurations.map((duration) => {
                  const markers = duration.benchmarks.map((level) => (
                    <span
                      className={`bp-react-marker bp-react-marker--${level.id}`}
                      key={`${duration.key}-${level.id}`}
                      style={{ left: `${level.valueRatio * 100}%` }}
                      title={`${level.label}: ${level.formattedValue}`}
                    >
                      {level.short}
                    </span>
                  ));
                  const userPercent = Math.max(0, Math.min(100, duration.percentWorldTour));
                  const goalText = duration.nextLevel ? (
                    <span className="bp-react-goal">
                      {formatDelta(duration.nextLevel.delta, { usingWkg: duration.usingWkg })} to reach {duration.nextLevel.label}
                    </span>
                  ) : (
                    <span className="bp-react-goal">Top benchmark held.</span>
                  );

                  return (
                    <div className="bp-react-detail-row" key={duration.key}>
                      <div className="bp-react-detail-label">
                        <span>{duration.label}</span>
                        <small>{duration.energySystem}</small>
                      </div>
                      <div className="bp-react-detail-rail">
                        <div className="bp-react-detail-bar">
                          <div className="bp-react-detail-fill" style={{ width: `${userPercent}%` }}></div>
                        </div>
                        <div className="bp-react-detail-markers">{markers}</div>
                      </div>
                      <div className="bp-react-detail-legend">
                        <span className="bp-react-legend-chip bp-react-legend-chip--club">Dev</span>
                        <span className="bp-react-legend-chip bp-react-legend-chip--amateur">Am</span>
                        <span className="bp-react-legend-chip bp-react-legend-chip--cat1">Cat1</span>
                        <span className="bp-react-legend-chip bp-react-legend-chip--pro">Pro</span>
                        <span className="bp-react-legend-chip bp-react-legend-chip--worldTour">WT</span>
                      </div>
                      <div className="bp-react-detail-stats">
                        <div className="bp-react-detail-metrics">
                          <strong>{duration.formattedValue}</strong>
                          <span>{duration.percentWorldTour}% WT</span>
                        </div>
                        {goalText}
                        <span className={`bp-badge ${duration.level.className}`}>{duration.level.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bp-react-empty">
            <i data-feather="bar-chart-2"></i>
            <p>Upload rides to unlock benchmark comparison.</p>
          </div>
        )}
      </section>

      <section className="bp-react-section">
        <header className="bp-react-section__header">
          <div>
            <h2>Next Milestones</h2>
            <p>Your pathway to the next performance level.</p>
          </div>
        </header>
        {milestoneDurations.length ? (
          <div className="bp-react-milestone-grid">
            {[...milestoneDurations]
              .sort((a, b) => a.nextLevel.delta - b.nextLevel.delta)
              .map((duration) => (
                <div className="bp-react-milestone" key={duration.key}>
                  <div className="bp-react-milestone__header">
                    <span>{duration.label}</span>
                    <small>{duration.energySystem}</small>
                  </div>
                  <div className="bp-react-milestone__body">
                    <div>
                      <span className="bp-react-milestone__delta">
                        {formatDelta(duration.nextLevel.delta, { usingWkg: duration.usingWkg })}
                      </span>
                      <span> to reach </span>
                      <span className={`bp-badge ${duration.nextLevel.className}`}>{duration.nextLevel.label}</span>
                    </div>
                    <p>
                      Current: {duration.formattedValue} → Target: {formatPowerValue(duration.nextLevel.value, { usingWkg: duration.usingWkg })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="bp-react-empty">
            <i data-feather="target"></i>
            <p>
              {durationData.some((d) => d.hasValue)
                ? "You're at the top benchmark across all durations!"
                : 'Complete a few power-based rides to unlock milestones.'}
            </p>
          </div>
        )}
      </section>

      <section className="bp-react-section">
        <header className="bp-react-section__header">
          <div>
            <h2>Performance Insights</h2>
            <p>Personalized recommendations based on your power data.</p>
          </div>
        </header>
        {insights.length ? (
          <div className="bp-react-insight-grid">
            {insights.map((insight) => (
              <article className="bp-react-insight-card" key={insight.title}>
                <header>
                  <h3>{insight.title}</h3>
                  <span className={`bp-badge ${insight.badgeClass}`}>{insight.badge}</span>
                </header>
                <p>{insight.body}</p>
                {insight.footer ? <footer>{insight.footer}</footer> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="bp-react-empty">
            <i data-feather="lightbulb"></i>
            <p>Complete more rides to unlock personalized insights.</p>
          </div>
        )}
      </section>
    </div>
  );
}
