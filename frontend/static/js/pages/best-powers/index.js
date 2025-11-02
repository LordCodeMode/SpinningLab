// ============================================================
// BEST POWERS PAGE – PERFORMANCE PROFILE OVERHAUL
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const DEFAULT_WEIGHT = 75;

const DURATION_SEGMENTS = [
  {
    key: 'max_5sec_power',
    label: '5s',
    seconds: 5,
    systemId: 'sprint',
    energySystem: 'Sprint Launch',
    description: 'Explosive neuromuscular effort for jump power.',
    icon: 'zap'
  },
  {
    key: 'max_1min_power',
    label: '1m',
    seconds: 60,
    systemId: 'anaerobic',
    energySystem: 'Anaerobic Punch',
    description: 'Repeated surges for steep ramps or attacks.',
    icon: 'activity'
  },
  {
    key: 'max_5min_power',
    label: '5m',
    seconds: 300,
    systemId: 'vo2max',
    energySystem: 'VO₂ Max Engine',
    description: 'Measures your aerobic ceiling for decisive climbs.',
    icon: 'triangle'
  },
  {
    key: 'max_20min_power',
    label: '20m',
    seconds: 1200,
    systemId: 'threshold',
    energySystem: 'Threshold Grind',
    description: 'Time-trial capability and FTP proxy.',
    icon: 'trending-up'
  },
  {
    key: 'max_60min_power',
    label: '60m',
    seconds: 3600,
    systemId: 'endurance',
    energySystem: 'Endurance Diesel',
    description: 'Sustainable aerobic durability for stage racing.',
    icon: 'layers'
  }
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
      max_60min_power: 5.6
    }
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
      max_60min_power: 5.1
    }
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
      max_60min_power: 4.4
    }
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
      max_60min_power: 3.6
    }
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
      max_60min_power: 2.8
    }
  }
];

const NO_DATA_LEVEL = {
  id: 'none',
  label: 'Record Needed',
  short: '—',
  rank: 999,
  className: 'bp-badge--muted'
};

const PROFILE_ARCHETYPES = {
  sprint: {
    title: 'Explosive Sprinter',
    subtitle: 'Fast-twitch dominance',
    focus: 'Sharpen neuromuscular power with sprint drills and strength work.'
  },
  anaerobic: {
    title: 'Punchy Climber',
    subtitle: 'Anaerobic repeatability',
    focus: 'Blend 30–60s surges with VO₂ micro intervals to keep the sting.'
  },
  vo2max: {
    title: 'VO₂ Max Engine',
    subtitle: 'High aerobic ceiling',
    focus: 'Regular VO₂ blocks and race simulations keep the top-end primed.'
  },
  threshold: {
    title: 'Time Trial Specialist',
    subtitle: 'Relentless threshold power',
    focus: 'Sweet spot over/unders and long steady efforts push FTP higher.'
  },
  endurance: {
    title: 'Endurance Diesel',
    subtitle: 'Superior aerobic durability',
    focus: 'Back-to-back endurance and tempo rides reinforce late-race stamina.'
  }
};

class BestPowersPage {
  constructor() {
    this.config = CONFIG;
    this.data = null;
    this.settings = null;
    this.powerChart = null;
    this.radarChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('best-powers');
      this.renderLoading();

      const [data, settings] = await Promise.all([
        Services.data.getBestPowerValues(),
        Services.data.getSettings()
      ]);

      this.data = data;
      this.settings = settings;

      this.render();
    } catch (error) {
      console.error('[BestPowersPage] load failed:', error);
      Services.analytics.trackError('best_powers_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    const weight = this.parseWeight(this.settings?.weight);
    const usingWkg = Number.isFinite(weight) && weight > 0;

    const durationData = this.prepareDurationData({ weight, usingWkg });
    const profile = this.buildProfile(durationData);
    const insights = this.buildInsights(durationData, profile, { usingWkg, weight });

    container.innerHTML = `
      <div class="bp-shell">
        ${this.renderHero(profile, durationData, { usingWkg, weight })}
        ${this.renderMetricsSection(durationData, { usingWkg })}
        ${this.renderBenchmarkSection(durationData)}
        ${this.renderMilestonesSection(durationData)}
        ${this.renderInsightsSection(insights)}
      </div>
    `;

    if (typeof feather !== 'undefined') {
      feather.replace();
    }

    this.renderRadarChart(durationData);
    this.renderPowerCurve(durationData, { usingWkg, weight });
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = LoadingSkeleton({ type: 'metric', count: 6 });
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = `
      <div class="error-state">
        <h3>Failed to load best powers</h3>
        <p>${this.escapeHtml(error?.message || 'Unknown error')}</p>
      </div>
    `;
  }

  renderHero(profile, durationData, { usingWkg, weight }) {
    const highlightDurations = profile.topDurations || [];
    const radarAvailable = durationData.some(item => item.hasValue);

    const quickStats = highlightDurations.length
      ? highlightDurations.map(duration => `
          <div class="bp-quick-stat">
            <span class="bp-quick-stat__label">${duration.label}</span>
            <span class="bp-quick-stat__value">${duration.formattedValue}</span>
            <span class="bp-quick-stat__meta">${duration.percentWorldTour}% of WT</span>
          </div>
        `).join('')
      : `
          <div class="bp-quick-stat bp-quick-stat--empty">
            <span>No power records yet</span>
          </div>
        `;

    const radarContent = radarAvailable
      ? '<canvas id="bp-radar-chart" aria-label="Power profile radar"></canvas>'
      : `
          <div class="bp-hero__radar-empty">
            <i data-feather="pie-chart"></i>
            <p>Radar visualization requires at least one power record</p>
          </div>
        `;

    const radarLegend = radarAvailable
      ? `
          <ul class="bp-hero__legend">
            <li><span class="bp-legend-dot bp-legend-dot--primary"></span>Your Profile</li>
            <li><span class="bp-legend-dot bp-legend-dot--secondary"></span>WorldTour Standard</li>
          </ul>
        `
      : '';

    return `
      <section class="bp-hero">
        <div class="bp-hero__content">
          <div class="bp-hero__meta">
            <span class="bp-pill">
              <i data-feather="activity"></i>
              Power Profile
            </span>
            <span class="bp-pill bp-pill--muted">
              ${usingWkg ? `${weight.toFixed(1)} kg` : 'Absolute Power'}
            </span>
          </div>

          <div>
            <h1>${this.escapeHtml(profile.title)}</h1>
            <p class="bp-hero__subtitle">${this.escapeHtml(profile.subtitle)}</p>
          </div>

          <p class="bp-hero__description">${this.escapeHtml(profile.description)}</p>

          <div class="bp-hero__focus">
            <span>Training Focus</span>
            <p style="margin:0; color:inherit; font-weight:var(--font-weight-medium);">${this.escapeHtml(profile.focus)}</p>
          </div>

          <div class="bp-hero__stats">
            <div class="bp-hero__stat-card">
              <span class="bp-hero__stat-label">Average vs WT</span>
              <span class="bp-hero__stat-value">${profile.averagePercent}%</span>
              <span class="bp-hero__stat-meta">Across all durations</span>
            </div>
            <div class="bp-hero__stat-card">
              <span class="bp-hero__stat-label">Strongest System</span>
              <span class="bp-hero__stat-value">${this.escapeHtml(profile.primarySystem)}</span>
              <span class="bp-hero__stat-meta">${this.escapeHtml(profile.primaryDurationLabel)}</span>
            </div>
          </div>

          <div class="bp-hero__quick-stats">
            ${quickStats}
          </div>
        </div>

        <div class="bp-hero__viz">
          <div class="bp-hero__chart">
            <div class="bp-hero__chart-wrapper">
              ${radarContent}
            </div>
            ${radarLegend}
          </div>
        </div>
      </section>
    `;
  }

  renderMetricsSection(durationData, { usingWkg }) {
    const cards = durationData.map(duration => {
      const badge = duration.hasValue
        ? `<span class="bp-badge ${duration.level.className}">${this.escapeHtml(duration.level.short)}</span>`
        : '';

      const content = duration.hasValue
        ? `
            <div class="bp-metric-value">${duration.formattedValue}</div>
            <div class="bp-metric-meta">
              <span>${duration.percentWorldTour}% of WorldTour</span>
              <span>${this.escapeHtml(duration.level.label)}</span>
            </div>
            <p>${this.escapeHtml(duration.description)}</p>
          `
        : `
            <div class="bp-metric-empty">No record yet</div>
            <p>${this.escapeHtml(duration.description)}</p>
          `;

      return `
        <article class="bp-metric-card ${duration.hasValue ? '' : 'bp-metric-card--empty'}">
          <header>
            <span class="bp-metric-label">
              <i data-feather="${duration.icon}"></i>
              ${duration.label} — ${this.escapeHtml(duration.energySystem)}
            </span>
            ${badge}
          </header>
          ${content}
        </article>
      `;
    }).join('');

    return `
      <section class="bp-section">
        <header class="bp-section__header">
          <h2 class="bp-section__title">Performance Metrics</h2>
          <p class="bp-section__subtitle">Your peak power output across key durations</p>
        </header>
        <div class="bp-metric-grid">
          ${cards}
        </div>
      </section>
    `;
  }

  renderBenchmarkSection(durationData) {
    const validDurations = durationData.filter(item => item.hasValue);

    if (!validDurations.length) {
      return `
        <section class="bp-section">
          <header class="bp-section__header">
            <h2 class="bp-section__title">Benchmark Analysis</h2>
            <p class="bp-section__subtitle">Compare your power profile against competitive standards</p>
          </header>
          <div class="bp-benchmark-empty">
            <i data-feather="bar-chart-2" style="width:32px; height:32px; color:var(--color-primary-400);"></i>
            <p>Upload rides to unlock benchmark comparison</p>
          </div>
        </section>
      `;
    }

    const benchmarkRows = validDurations.map(duration => {
      const markers = duration.benchmarks
        .map(level => {
          const percent = Math.max(0, Math.min(100, level.percent));
          return `
            <div 
              class="bp-marker bp-marker--${level.id}" 
              style="left: ${level.valueRatio * 100}%;"
              title="${this.escapeHtml(level.label)}: ${level.formattedValue}"
            >
              ${this.escapeHtml(level.short)}
            </div>
          `;
        })
        .join('');

      const userPercent = Math.max(0, Math.min(100, duration.percentWorldTour));

      const goalText = duration.nextLevel
        ? `<div class="bp-benchmark-row__goal">
             ${this.formatDelta(duration.nextLevel.delta, { usingWkg: duration.usingWkg })} to reach ${this.escapeHtml(duration.nextLevel.label)}
           </div>`
        : '';

      return `
        <div class="bp-benchmark-row">
          <div class="bp-benchmark-row__label">
            <span>${duration.label}</span>
            <small>${this.escapeHtml(duration.energySystem)}</small>
          </div>

          <div class="bp-benchmark-row__body">
            <div class="bp-progress-track">
              <div class="bp-progress-fill" style="width: ${userPercent}%;"></div>
              ${markers}
            </div>

            <div class="bp-benchmark-row__stats">
              <div class="bp-benchmark-row__stat">
                <span class="bp-benchmark-row__stat-value">${duration.formattedValue}</span>
                <span class="bp-benchmark-row__stat-label">Your Best</span>
              </div>
              <div class="bp-benchmark-row__stat">
                <span class="bp-benchmark-row__stat-value">${duration.percentWorldTour}%</span>
                <span class="bp-benchmark-row__stat-label">vs WorldTour</span>
              </div>
              ${goalText}
            </div>
          </div>

          <span class="bp-badge ${duration.level.className}">
            ${this.escapeHtml(duration.level.label)}
          </span>
        </div>
      `;
    }).join('');

    return `
      <section class="bp-section">
        <header class="bp-section__header">
          <h2 class="bp-section__title">Benchmark Analysis</h2>
          <p class="bp-section__subtitle">Compare your power profile against competitive standards</p>
        </header>
        <div class="bp-analytics-stack">
          <div class="bp-card bp-card--chart">
            <div class="bp-card__header">
              <h3>Power Curve vs Benchmarks</h3>
              <span class="bp-card__hint">Interactive</span>
            </div>
            <div class="bp-card__body">
              <canvas id="bp-power-curve-chart"></canvas>
            </div>
          </div>
          <div class="bp-card bp-card--list">
            <div class="bp-card__header">
              <h3>Detailed Comparison</h3>
            </div>
            <div class="bp-card__body bp-card__body--list">
              ${benchmarkRows}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderMilestonesSection(durationData) {
    const validDurations = durationData.filter(item => item.hasValue && item.nextLevel);

    if (!validDurations.length) {
      return `
        <section class="bp-section">
          <header class="bp-section__header">
            <h2 class="bp-section__title">Next Milestones</h2>
            <p class="bp-section__subtitle">Your pathway to the next performance level</p>
          </header>
          <div class="bp-milestones-empty">
            <i data-feather="target" style="width:32px; height:32px;"></i>
            <p>${durationData.some(d => d.hasValue) ? 'You\'re at the top benchmark across all durations!' : 'Complete a few power-based rides to unlock milestones'}</p>
          </div>
        </section>
      `;
    }

    const sortedByDelta = [...validDurations].sort((a, b) => a.nextLevel.delta - b.nextLevel.delta);

    const milestones = sortedByDelta.map(duration => `
      <div class="bp-milestone-item">
        <div class="bp-milestone-label">
          <span>${duration.label}</span>
          <small>${this.escapeHtml(duration.energySystem)}</small>
        </div>
        <div class="bp-milestone-body">
          <div>
            <span class="bp-milestone-delta">${this.formatDelta(duration.nextLevel.delta, { usingWkg: duration.usingWkg })}</span>
            <span style="color:var(--color-text-secondary);"> to reach </span>
            <span class="bp-badge ${duration.nextLevel.className}">${this.escapeHtml(duration.nextLevel.label)}</span>
          </div>
          <p style="margin:0; font-size:var(--font-size-sm); color:var(--color-text-secondary);">
            Current: ${duration.formattedValue} → Target: ${this.formatPowerValue(duration.nextLevel.value, { usingWkg: duration.usingWkg })}
          </p>
        </div>
      </div>
    `).join('');

    return `
      <section class="bp-section">
        <header class="bp-section__header">
          <h2 class="bp-section__title">Next Milestones</h2>
          <p class="bp-section__subtitle">Your pathway to the next performance level</p>
        </header>
        <div class="bp-milestone-list">
          ${milestones}
        </div>
      </section>
    `;
  }

  renderInsightsSection(insights) {
    if (!insights.length) {
      return `
        <section class="bp-section">
          <header class="bp-section__header">
            <h2 class="bp-section__title">Performance Insights</h2>
            <p class="bp-section__subtitle">Personalized recommendations based on your power data</p>
          </header>
          <div class="bp-insight-empty">
            <i data-feather="lightbulb" style="width:32px; height:32px;"></i>
            <p>Complete more rides to unlock personalized insights</p>
          </div>
        </section>
      `;
    }

    const insightCards = insights.map(insight => `
      <article class="bp-insight-card">
        <header>
          <h3>${this.escapeHtml(insight.title)}</h3>
          <span class="bp-badge ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
        </header>
        <p>${this.escapeHtml(insight.body)}</p>
        ${insight.footer ? `<footer>${this.escapeHtml(insight.footer)}</footer>` : ''}
      </article>
    `).join('');

    return `
      <section class="bp-section">
        <header class="bp-section__header">
          <h2 class="bp-section__title">Performance Insights</h2>
          <p class="bp-section__subtitle">Personalized recommendations based on your power data</p>
        </header>
        <div class="bp-insight-grid">
          ${insightCards}
        </div>
      </section>
    `;
  }

  renderRadarChart(durationData) {
    const canvas = document.getElementById('bp-radar-chart');
    if (!canvas) return;

    const validDurations = durationData.filter(item => item.hasValue);
    if (!validDurations.length) return;

    if (this.radarChart) {
      this.radarChart.destroy();
    }

    const labels = validDurations.map(d => d.energySystem);
    const userValues = validDurations.map(d => d.percentWorldTour);
    const wtValues = validDurations.map(() => 100);

    this.radarChart = new Chart(canvas, {
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
            pointHoverRadius: 6
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
            pointHoverRadius: 5
          }
        ]
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
              label: context => `${context.dataset.label}: ${context.parsed.r}%`
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 120,
            ticks: {
              stepSize: 20,
              font: { size: 11 },
              color: '#94a3b8',
              backdropColor: 'transparent'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
              lineWidth: 1
            },
            pointLabels: {
              font: { size: 12, weight: '600' },
              color: '#475569'
            }
          }
        }
      }
    });
  }

  renderPowerCurve(durationData, { usingWkg, weight }) {
    const canvas = document.getElementById('bp-power-curve-chart');
    if (!canvas) return;

    const validDurations = durationData.filter(item => item.hasValue);
    if (!validDurations.length) return;

    if (this.powerChart) {
      this.powerChart.destroy();
    }

    const labels = validDurations.map(d => d.label);
    const userData = validDurations.map(d => d.measurementValue);

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
        fill: true
      }
    ];

    const benchmarkColors = {
      worldTour: { border: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.08)' },
      pro: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)' },
      cat1: { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' }
    };

    ['worldTour', 'pro', 'cat1'].forEach(levelId => {
      const levelData = validDurations.map(d => {
        const benchmark = d.benchmarks.find(b => b.id === levelId);
        return benchmark ? benchmark.value : null;
      });

      datasets.push({
        label: BENCHMARK_LEVELS.find(l => l.id === levelId)?.label || levelId,
        data: levelData,
        borderColor: benchmarkColors[levelId].border,
        backgroundColor: benchmarkColors[levelId].bg,
        borderWidth: 2,
        borderDash: [5, 3],
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: false
      });
    });

    this.powerChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
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
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: context => {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${this.formatTooltipValue(value, { usingWkg })}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 12, weight: '600' },
              color: '#64748b'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.1)',
              lineWidth: 1
            },
            ticks: {
              font: { size: 11 },
              color: '#94a3b8',
              callback: value => this.formatAxisValue(value, { usingWkg })
            },
            title: {
              display: true,
              text: usingWkg ? 'W/kg' : 'Watts',
              font: { size: 12, weight: '600' },
              color: '#64748b'
            }
          }
        }
      }
    });
  }

  prepareDurationData({ weight, usingWkg }) {
    if (!this.data) return [];

    const defaultWeight = weight || DEFAULT_WEIGHT;

    return DURATION_SEGMENTS.map(segment => {
      const rawValue = this.toNumber(this.data?.[segment.key]);
      const hasValue = Number.isFinite(rawValue) && rawValue > 0;
      const absoluteValue = hasValue ? rawValue : null;
      const valueWkg = hasValue
        ? (usingWkg ? rawValue / weight : rawValue / defaultWeight)
        : null;

      const measurementValue = usingWkg ? valueWkg : absoluteValue;
      const measurementUnit = usingWkg ? 'W/kg' : 'Watts';

      const benchmarks = BENCHMARK_LEVELS.map(level => {
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
          formattedValue: this.formatPowerValue(referenceValue, { usingWkg }),
          measurementUnit
        };
      });

      const benchmarksById = benchmarks.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});

      const level = this.determineLevel(measurementValue, benchmarks);
      const nextLevel = this.determineNextLevel(measurementValue, benchmarks, level);

      return {
        ...segment,
        key: segment.key,
        hasValue,
        value: absoluteValue,
        valueWkg,
        measurementValue,
        measurementUnit,
        formattedValue: this.formatPowerValue(measurementValue, { usingWkg }),
        percentWorldTour: benchmarksById.worldTour?.percent || 0,
        benchmarks,
        benchmarksById,
        level,
        nextLevel,
        usingWkg
      };
    });
  }

  determineLevel(measurementValue, benchmarks) {
    if (!Number.isFinite(measurementValue) || measurementValue <= 0) {
      return NO_DATA_LEVEL;
    }
    const ordered = [...benchmarks].sort((a, b) => a.rank - b.rank);
    const matched = ordered.find(level => measurementValue >= level.value);
    return matched || ordered[ordered.length - 1] || NO_DATA_LEVEL;
  }

  determineNextLevel(measurementValue, benchmarks, currentLevel) {
    if (!Number.isFinite(measurementValue) || measurementValue <= 0) return null;
    const ordered = [...benchmarks].sort((a, b) => a.rank - b.rank);
    const currentIndex = ordered.findIndex(level => level.id === currentLevel.id);
    if (currentIndex <= 0) return null;
    const next = ordered[currentIndex - 1];
    return {
      ...next,
      delta: next.value - measurementValue
    };
  }

  buildProfile(durationData) {
    const validDurations = durationData.filter(item => item.hasValue);
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
        topDurations: []
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
        ? `${this.formatDelta(nextLevel.value - weakest.measurementValue, { usingWkg: weakest.usingWkg })} to improve your ${weakest.label} record`
        : 'You are already matching the top benchmark – focus on maintaining consistency.',
      topDurations: sortedByLevel.slice(0, 3)
    };
  }

  buildInsights(durationData, profile, { usingWkg, weight }) {
    const insights = [];
    const validDurations = durationData.filter(item => item.hasValue);

    if (!validDurations.length) {
      if (!usingWkg) {
        insights.push({
          title: 'Log your weight',
          body: 'Adding your body mass in settings unlocks W/kg comparisons, climb readiness, and more precise insights.',
          badge: 'Setup Tip',
          badgeClass: 'bp-badge--muted'
        });
      }
      return insights;
    }

    const strongest = profile.topDurations?.[0] || validDurations[0];
    insights.push({
      title: `${strongest.energySystem} Strength`,
      body: `Your ${strongest.label} record sits at ${strongest.formattedValue}, ranking ${strongest.level.label} (${strongest.percentWorldTour}% of WorldTour). Lean into this advantage by scheduling workouts that reinforce it.`,
      badge: strongest.level.label,
      badgeClass: strongest.level.className
    });

    const weakest = [...validDurations].sort((a, b) => (a.percentWorldTour || 0) - (b.percentWorldTour || 0))[0];
    if (weakest) {
      const nextText = weakest.nextLevel
        ? `${this.formatDelta(weakest.nextLevel.value - weakest.measurementValue, { usingWkg })} to reach ${weakest.nextLevel.label}`
        : 'Maintain consistency to keep pushing the entire curve upward.';

      insights.push({
        title: `${weakest.energySystem} Opportunity`,
        body: `Your ${weakest.label} record is currently ${weakest.level.label} (${weakest.formattedValue}). ${nextText}`,
        badge: 'Next Goal',
        badgeClass: 'bp-badge--warning'
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
      footer: weightMessage
    });

    return insights;
  }

  toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  parseWeight(value) {
    const parsed = this.toNumber(value);
    return parsed && parsed > 0 ? parsed : null;
  }

  formatPowerValue(value, { usingWkg }) {
    if (!Number.isFinite(value) || value <= 0) return '—';
    if (usingWkg) return `${value.toFixed(2)} W/kg`;
    if (value >= 1000) return `${Math.round(value)} W`;
    if (value >= 100) return `${value.toFixed(0)} W`;
    return `${value.toFixed(1)} W`;
  }

  formatTooltipValue(value, { usingWkg }) {
    if (!Number.isFinite(value)) return '—';
    if (usingWkg) return `${value.toFixed(2)} W/kg`;
    return `${Math.round(value)} W`;
  }

  formatAxisValue(value, { usingWkg }) {
    if (!Number.isFinite(value)) return '';
    if (usingWkg) return value.toFixed(1);
    if (Math.abs(value) >= 1000) return Math.round(value);
    return value.toFixed(0);
  }

  formatDelta(delta, { usingWkg }) {
    if (!Number.isFinite(delta)) return '';
    const sign = delta > 0 ? '+' : '';
    if (usingWkg) return `${sign}${delta.toFixed(2)} W/kg`;
    if (Math.abs(delta) >= 10) return `${sign}${Math.round(delta)} W`;
    return `${sign}${delta.toFixed(1)} W`;
  }

  escapeHtml(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  onUnload() {
    if (this.powerChart) {
      this.powerChart.destroy();
      this.powerChart = null;
    }
    if (this.radarChart) {
      this.radarChart.destroy();
      this.radarChart = null;
    }
    this.data = null;
    this.settings = null;
  }
}

const bestPowersPage = new BestPowersPage();
export default bestPowersPage;
