// =========================
// UI COMPONENTS INDEX
// Central export point for all React UI components
// =========================

// Cards
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  ActivitiesCard,
  AnalysisCard,
  CompactCard,
  InfoCard,
  FeatureCard
} from './Card.jsx';
export { GlassCard } from './GlassCard.jsx';

// Metrics
export {
  MetricCard,
  MetricGrid,
  SimpleMetric,
  StatusMetric,
  ProgressMetric,
  ComparisonMetric,
  MiniMetric
} from './MetricCard.jsx';

// Charts
export {
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
} from './ChartCard.jsx';

// Insights
export {
  InsightCard,
  InsightGrid,
  InsightBadge,
  RecommendationList,
  InsightPanel,
  InsightMetric,
  InsightTimeline,
  InsightStats,
  QuickInsight
} from './InsightCard.jsx';

// Buttons
export {
  Button,
  ButtonGroup,
  IconButton,
  FAB,
  LinkButton
} from './Button.jsx';

// Badges
export {
  Badge,
  StatusBadge,
  NotificationBadge,
  GradientBadge,
  BadgeGroup,
  InteractiveBadge
} from './Badge.jsx';

// States
export {
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
} from './States.jsx';

// Workouts
export {
  WorkoutCard,
  CompactWorkoutCard
} from './WorkoutCard.jsx';

// Default exports
export { default as ButtonComponent } from './Button.jsx';
export { default as BadgeComponent } from './Badge.jsx';
export { default as CardComponent } from './Card.jsx';
export { default as MetricCardComponent } from './MetricCard.jsx';
export { default as ChartCardComponent } from './ChartCard.jsx';
export { default as InsightCardComponent } from './InsightCard.jsx';
export { default as StatesComponent } from './States.jsx';
export { default as WorkoutCardComponent } from './WorkoutCard.jsx';
