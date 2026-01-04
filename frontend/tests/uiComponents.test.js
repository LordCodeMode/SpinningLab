import { describe, it, expect, vi } from 'vitest';
import { Badge } from '../static/js/components/ui/Badge.js';
import { Button, ButtonGroup, IconButton, FAB, LinkButton } from '../static/js/components/ui/Button.js';
import { Card, CardHeader, CardBody, CardFooter, ActivitiesCard, AnalysisCard, CompactCard } from '../static/js/components/ui/Card.js';
import {
  ChartCard,
  ChartControls,
  ChartLoading,
  ChartEmpty,
  ChartLegend,
  ChartInsights,
  ChartToolbar,
  ChartZoomControls,
  ChartContainer,
  ChartGrid
} from '../static/js/components/ui/ChartCard.js';
import { InsightCard } from '../static/js/components/ui/InsightCard.js';
import {
  MetricCard,
  MetricGrid,
  SimpleMetric,
  StatusMetric,
  ProgressMetric,
  ComparisonMetric,
  MiniMetric
} from '../static/js/components/ui/MetricCard.js';
import {
  SkeletonLoader,
  showLoading,
  hideLoading,
  withLoading
} from '../static/js/components/ui/SkeletonLoader.js';
import {
  LoadingSkeleton,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  NoResultsState,
  SuccessState,
  MaintenanceState,
  OfflineState,
  PermissionDeniedState,
  ComingSoonState
} from '../static/js/components/ui/States.js';
import { WorkoutCard, CompactWorkoutCard, generateIntervalPreview } from '../static/js/components/ui/WorkoutCard.js';
import UI from '../static/js/components/ui/index.js';

describe('UI component builders', () => {
  it('renders badges and buttons with variants and escaping', () => {
    const badge = Badge({
      text: '<Hot>',
      variant: 'danger',
      style: 'solid',
      size: 'lg',
      icon: '<svg></svg>',
      removable: true,
      onRemove: 'removeTag()',
      pulse: true,
      customClass: 'extra'
    });
    expect(badge).toContain('badge--danger');
    expect(badge).toContain('badge--solid');
    expect(badge).toContain('badge--pulse');
    expect(badge).toContain('badge--removable');
    expect(badge).toContain('removeTag()');
    expect(badge).toContain('&lt;Hot&gt;');

    const button = Button({
      text: 'Save',
      variant: 'primary',
      size: 'lg',
      icon: '<svg></svg>',
      iconPosition: 'right',
      onClick: 'doSave()',
      loading: true,
      block: true,
      customClass: 'custom',
      id: 'save-btn'
    });
    expect(button).toContain('btn--loading');
    expect(button).toContain('btn--block');
    expect(button).toContain('onclick="doSave()"');
    expect(button).toContain('id="save-btn"');
    expect(button).toContain('disabled');

    const group = ButtonGroup({
      attached: true,
      buttons: [{ text: 'A' }, '<span>Raw</span>']
    });
    expect(group).toContain('btn-group--attached');
    expect(group).toContain('btn btn--primary');
    expect(group).toContain('Raw');

    const iconBtn = IconButton({
      icon: '<svg></svg>',
      title: '"Edit"',
      onClick: 'edit()'
    });
    expect(iconBtn).toContain('icon-btn');
    expect(iconBtn).toContain('title="&quot;Edit&quot;"');

    const fab = FAB({ onClick: 'openModal()' });
    expect(fab).toContain('fab');
    expect(fab).toContain('openModal()');

    const link = LinkButton({ text: 'Docs', href: '/docs', icon: '<svg></svg>' });
    expect(link).toContain('href="/docs"');
    expect(link).toContain('Docs');
  });

  it('builds cards and chart helpers', () => {
    const card = Card({
      id: 'card-1',
      title: 'Title',
      subtitle: 'Sub',
      icon: '<svg></svg>',
      content: '<p>Body</p>',
      footer: '<span>Footer</span>',
      clickable: true,
      noHover: true,
      customClass: 'custom'
    });
    expect(card).toContain('card--clickable');
    expect(card).toContain('card--no-hover');
    expect(card).toContain('Footer');

    const header = CardHeader({ title: 'Header', subtitle: 'Sub', icon: '<svg></svg>', actions: '<button></button>' });
    expect(header).toContain('card__actions');

    const body = CardBody({ content: '<p>Body</p>', customClass: 'pad' });
    expect(body).toContain('card__body pad');

    const footer = CardFooter({ content: 'Foot', customClass: 'tight' });
    expect(footer).toContain('card__footer tight');

    const activitiesCard = ActivitiesCard({ title: 'Recent', content: '<div></div>' });
    expect(activitiesCard).toContain('activities-card-title');

    const analysisCard = AnalysisCard({
      title: 'Analysis',
      stats: [{ label: 'TSS', value: '100' }]
    });
    expect(analysisCard).toContain('analysis-stat__label');

    const compact = CompactCard({
      title: 'CTL',
      value: '55',
      trend: { direction: 'up', value: '+3' }
    });
    expect(compact).toContain('compact-card__trend--up');

    const chartCard = ChartCard({
      title: 'Trend',
      subtitle: 'Last 30 days',
      controls: '<button>30d</button>',
      chartId: 'chart-1',
      chartHeight: '320px',
      loading: true,
      footer: '<div>Footer</div>'
    });
    expect(chartCard).toContain('chart-loading');
    expect(chartCard).toContain('chart-footer');

    const controls = ChartControls({ ranges: ['30d', '90d'], activeRange: '30d' });
    expect(controls).toContain('chart-control active');

    const empty = ChartEmpty({ title: 'None', message: 'No data', action: '<button>Retry</button>' });
    expect(empty).toContain('chart-empty__action');

    expect(ChartLegend({ items: [] })).toBe('');

    const legend = ChartLegend({ items: [{ label: 'A', color: '#000' }] });
    expect(legend).toContain('chart-legend__item');

    const insights = ChartInsights({ insights: ['Keep it steady'] });
    expect(insights).toContain('chart-insights__item');

    const toolbar = ChartToolbar({ leftContent: '<div>L</div>', rightContent: '<div>R</div>' });
    expect(toolbar).toContain('chart-toolbar__left');

    const zoom = ChartZoomControls();
    expect(zoom).toContain('handleZoomIn');

    const container = ChartContainer({ chartId: 'power', height: '200px', ariaLabel: 'Power' });
    expect(container).toContain('id="power"');
    expect(container).toContain('aria-label="Power"');

    const grid = ChartGrid({ charts: ['<div>A</div>', '<div>B</div>'], columns: 3 });
    expect(grid).toContain('charts-grid--triple');
  });

  it('renders insight and metric components', () => {
    const insight = InsightCard({
      type: 'warning',
      title: 'Watch',
      text: 'Stay hydrated',
      priority: { level: 2, show: true }
    });
    expect(insight).toContain('insight-card--warning');
    expect(insight).toContain('insight-card__priority--2');

    const metric = MetricCard({
      label: 'CTL',
      value: 55,
      subtitle: 'Fitness',
      trend: { direction: 'up', value: '+3%' }
    });
    expect(metric).toContain('metric-card__trend--up');

    const grid = MetricGrid({ metrics: [{ label: 'A', value: 1 }] });
    expect(grid).toContain('metrics-grid');

    const simple = SimpleMetric({ label: 'Focus', value: 'Base' });
    expect(simple).toContain('simple-metric__value');

    const status = StatusMetric({ label: 'Status', value: 'Ok', status: 'success' });
    expect(status).toContain('status-metric--success');

    const progress = ProgressMetric({ label: 'Goal', value: 50, max: 200, unit: '%' });
    expect(progress).toContain('progress-metric__fill');

    const comparison = ComparisonMetric({ label: 'Power', current: 300, previous: 200 });
    expect(comparison).toContain('comparison-metric__change--up');

    const mini = MiniMetric({ label: 'HR', value: 120 });
    expect(mini).toContain('mini-metric__label');
  });

  it('handles skeleton loading helpers', async () => {
    const table = SkeletonLoader.table(2);
    expect(table.match(/skeleton-table__row/g)?.length).toBe(2);

    const metricGrid = SkeletonLoader.metricGrid(3);
    expect(metricGrid.match(/skeleton--metric/g)?.length).toBe(3);

    const spinner = SkeletonLoader.spinner('Working');
    expect(spinner).toContain('Working');

    document.body.innerHTML = '<div id="target"></div>';
    showLoading('#target', 'text', { lines: 2 });
    const target = document.getElementById('target');
    expect(target?.getAttribute('data-loading')).toBe('true');
    hideLoading('#target', '<span>Done</span>');
    expect(target?.innerHTML).toContain('Done');

    const asyncFn = vi.fn().mockResolvedValue('ok');
    const result = await withLoading(target, asyncFn, { type: 'metric' });
    expect(result).toBe('ok');

    const loading = LoadingSkeleton({ type: 'chart', count: 2 });
    expect(loading.match(/skeleton--chart/g)?.length).toBe(2);

    const spinnerState = LoadingSpinner({ text: 'Loading', size: 'sm' });
    expect(spinnerState).toContain('Loading');

    const empty = EmptyState({ title: 'Nothing', message: 'No rows' });
    expect(empty).toContain('empty-state__title');

    const error = ErrorState({ title: 'Oops', message: 'Failed' });
    expect(error).toContain('error-state');

    const noResults = NoResultsState({ query: 'query' });
    expect(noResults).toContain('No results found');

    const success = SuccessState({ title: 'Saved', message: 'All good' });
    expect(success).toContain('success-state');

    const maintenance = MaintenanceState({ title: 'Maintenance' });
    expect(maintenance).toContain('empty-state');
    expect(maintenance).toContain('Maintenance');

    const offline = OfflineState({ title: 'Offline' });
    expect(offline).toContain('error-state');
    expect(offline).toContain('Offline');

    const denied = PermissionDeniedState({ title: 'Denied' });
    expect(denied).toContain('error-state');
    expect(denied).toContain('Denied');

    const comingSoon = ComingSoonState({ title: 'Soon' });
    expect(comingSoon).toContain('empty-state');
    expect(comingSoon).toContain('Soon');
  });

  it('builds workout cards and interval previews', () => {
    const intervals = [
      { duration: 300, target_power_low: 50, target_power_high: 50, interval_type: 'warmup' },
      { duration: 600, target_power_low: 110, target_power_high: 110, interval_type: 'work' }
    ];

    const card = WorkoutCard({
      id: 1,
      name: 'Sweet Spot',
      description: 'Test',
      workoutType: 'Sweet Spot',
      totalDuration: 3600,
      estimatedTss: 85,
      intervals,
      onSchedule: () => {}
    });
    expect(card).toContain('workout-card__intervals');
    expect(card).toContain('workout-card__interval-bar');

    const compact = CompactWorkoutCard({
      id: 2,
      name: 'Recovery Ride',
      workoutType: 'Recovery',
      totalDuration: 1800,
      estimatedTss: 25
    });
    expect(compact).toContain('compact-workout-card__meta');

    const longIntervals = Array.from({ length: 13 }, () => ({
      duration: 60,
      target_power_low: 120,
      target_power_high: 120
    }));
    const preview = generateIntervalPreview(longIntervals);
    expect(preview).toContain('+1');
  });

  it('exports UI namespace helpers', () => {
    expect(UI.Button).toBeDefined();
    expect(UI.Card).toBeDefined();
    expect(UI.WorkoutCard).toBeDefined();
  });
});
