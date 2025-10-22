// =========================
// UI COMPONENTS INDEX
// Central export point for all UI components
// =========================

// Import all components
import { 
    Card, 
    CardHeader, 
    CardBody, 
    CardFooter,
    ActivitiesCard,
    AnalysisCard,
    CompactCard
  } from './Card.js';
  
  import { 
    MetricCard,
    MetricGrid,
    SimpleMetric,
    StatusMetric,
    ProgressMetric,
    ComparisonMetric,
    MiniMetric
  } from './MetricCard.js';
  
  import { 
    ChartCard,
    ChartControls,
    ChartEmpty,
    ChartLegend,
    ChartInsights,
    ChartToolbar,
    ChartZoomControls,
    ChartContainer,
    ChartGrid
  } from './ChartCard.js';
  
  import { 
    InsightCard,
    InsightGrid,
    InsightBadge,
    RecommendationList,
    InsightPanel,
    InsightMetric,
    InsightTimeline,
    InsightStats,
    QuickInsight
  } from './InsightCard.js';
  
  import { 
    Button,
    ButtonGroup,
    IconButton,
    FAB,
    LinkButton
  } from './Button.js';
  
import { 
    Badge,
    StatusBadge,
    NotificationBadge,
    GradientBadge,
    BadgeGroup,
    InteractiveBadge
  } from './Badge.js';
  
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
  } from './States.js';
  
  // Re-export all components individually
  export {
    // Cards
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    ActivitiesCard,
    AnalysisCard,
    CompactCard,
    
    // Metrics
    MetricCard,
    MetricGrid,
    SimpleMetric,
    StatusMetric,
    ProgressMetric,
    ComparisonMetric,
    MiniMetric,
    
    // Charts
    ChartCard,
    ChartControls,
    ChartEmpty,
    ChartLegend,
    ChartInsights,
    ChartToolbar,
    ChartZoomControls,
    ChartContainer,
    ChartGrid,
    
    // Insights
    InsightCard,
    InsightGrid,
    InsightBadge,
    RecommendationList,
    InsightPanel,
    InsightMetric,
    InsightTimeline,
    InsightStats,
    QuickInsight,
    
    // Buttons
    Button,
    ButtonGroup,
    IconButton,
    FAB,
    LinkButton,
    
    // Badges
    Badge,
    StatusBadge,
    NotificationBadge,
    GradientBadge,
    BadgeGroup,
    InteractiveBadge,
    
    // States
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
  };
  
  // Also export as namespace for convenience
  export const UI = {
    // Cards
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    ActivitiesCard,
    AnalysisCard,
    CompactCard,
    
    // Metrics
    MetricCard,
    MetricGrid,
    SimpleMetric,
    StatusMetric,
    ProgressMetric,
    ComparisonMetric,
    MiniMetric,
    
    // Charts
    ChartCard,
    ChartControls,
    ChartEmpty,
    ChartLegend,
    ChartInsights,
    ChartToolbar,
    ChartZoomControls,
    ChartContainer,
    ChartGrid,
    
    // Insights
    InsightCard,
    InsightGrid,
    InsightBadge,
    RecommendationList,
    InsightPanel,
    InsightMetric,
    InsightTimeline,
    InsightStats,
    QuickInsight,
    
    // Buttons
    Button,
    ButtonGroup,
    IconButton,
    FAB,
    LinkButton,
    
    // Badges
    Badge,
    StatusBadge,
    NotificationBadge,
    GradientBadge,
    BadgeGroup,
    InteractiveBadge,
    
    // States
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
  };
  
  // Default export
  export default UI;
  
  /* ===========================
     USAGE EXAMPLES
     =========================== */
  
  // Example 1: Named imports
  // import { MetricCard, ChartCard, InsightCard } from './components/ui/index.js';
  // const html = MetricCard({ label: 'CTL', value: '45.2', variant: 'primary' });
  
  // Example 2: Namespace import
  // import { UI } from './components/ui/index.js';
  // const html = UI.MetricCard({ label: 'CTL', value: '45.2', variant: 'primary' });
  
  // Example 3: Default import
  // import UI from './components/ui/index.js';
  // const html = UI.MetricCard({ label: 'CTL', value: '45.2', variant: 'primary' });
  
  /* ===========================
     QUICK REFERENCE
     =========================== */
  
  // CARDS
  // - Card: Basic card with header, body, footer
  // - MetricCard: KPI display with icon and trend
  // - ChartCard: Chart container with controls
  // - InsightCard: AI insight display
  // - ActivitiesCard: Activities list container
  // - AnalysisCard: Analysis/stats display
  // - CompactCard: Small dashboard widget
  
  // BUTTONS
  // - Button: Primary action button
  // - IconButton: Icon-only button
  // - ButtonGroup: Group of buttons
  // - FAB: Floating action button
  // - LinkButton: Button styled as link
  
  // BADGES
  // - Badge: Label/tag indicator
  // - StatusBadge: Status indicator (active/inactive)
  // - NotificationBadge: Notification count
  // - GradientBadge: Gradient styled badge
  
  // CHARTS
  // - ChartCard: Complete chart card wrapper
  // - ChartControls: Time range buttons
  // - ChartLegend: Chart legend display
  // - ChartInsights: Key insights panel
  
  // INSIGHTS
  // - InsightCard: Full insight card
  // - InsightBadge: Small insight indicator
  // - RecommendationList: Action recommendations
  // - InsightPanel: Full insight panel
  
  // STATES
  // - LoadingSkeleton: Animated loading placeholder
  // - LoadingSpinner: Loading spinner
  // - EmptyState: No data message
  // - ErrorState: Error message
  // - SuccessState: Success message
