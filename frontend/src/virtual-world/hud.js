/**
 * HUD (Heads-Up Display) - Zwift-Style
 *
 * A comprehensive overlay showing:
 * - Large power/HR/cadence metrics
 * - Gradient indicator with visual
 * - Elevation profile mini-map
 * - Workout controls
 * - Workout progress timeline
 */

import { REALISTIC_GRADIENT_LIMIT } from './scene-config.js';

const formatDuration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export class HUD {
  constructor(container) {
    this.container = container;
    this.elements = {};
    this.elevationData = [];
    this.lastRouteDistance = 0;
    this.onControl = null; // Callback for control actions
    this.onOptionChange = null; // Callback for settings changes
  }

  init() {
    this.container.innerHTML = `
      <style>
        .vw-hud {
          position: absolute;
          inset: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
          user-select: none;
        }

        .vw-hud * {
          pointer-events: auto;
        }

        /* ===== SETTINGS PANEL ===== */
        .vw-settings {
          position: absolute;
          top: 18px;
          left: 18px;
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: auto;
        }

        .vw-settings-toggle {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.7);
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .vw-settings-toggle:hover {
          transform: translateY(-1px);
          background: rgba(15, 23, 42, 0.9);
        }

        .vw-settings-panel {
          width: 220px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(12px);
          display: none;
        }

        .vw-settings-panel.is-open {
          display: block;
        }

        .vw-settings-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 10px;
        }

        .vw-settings-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
        }

        .vw-settings-select {
          width: 100%;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.7);
          color: #e2e8f0;
          font-size: 12px;
        }

        .vw-settings-range-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .vw-settings-range-row span {
          font-size: 11px;
          color: rgba(226, 232, 240, 0.88);
        }

        .vw-settings-range {
          width: 100%;
          accent-color: #60a5fa;
        }

        .vw-settings-reset {
          width: 100%;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background: rgba(30, 41, 59, 0.62);
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .vw-settings-reset:hover {
          background: rgba(51, 65, 85, 0.78);
        }

        /* ===== TOP BAR - Main Metrics ===== */
        .vw-top-bar {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 10px 16px;
          gap: 14px;
          z-index: 32;
          background: rgba(0, 0, 0, 0.45);
          border-radius: 20px;
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .vw-metric-card {
          background: rgba(10, 16, 28, 0.5);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 14px 18px;
          text-align: center;
          min-width: 130px;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .vw-metric-card--power {
          min-width: 160px;
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.3) 0%, rgba(6, 10, 18, 0.75) 100%);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .vw-metric-card--hr {
          min-width: 140px;
          background: linear-gradient(180deg, rgba(239, 68, 68, 0.3) 0%, rgba(0, 0, 0, 0.75) 100%);
          border-color: rgba(239, 68, 68, 0.35);
        }

        .vw-metric-card--cadence {
          min-width: 140px;
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.3) 0%, rgba(0, 0, 0, 0.75) 100%);
          border-color: rgba(16, 185, 129, 0.35);
        }

        .vw-metric-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
        }

        .vw-metric-value {
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        .vw-metric-card--power .vw-metric-value {
          font-size: 42px;
          color: #60a5fa;
        }

        .vw-metric-card--hr .vw-metric-value {
          font-size: 36px;
          color: #f87171;
        }

        .vw-metric-card--cadence .vw-metric-value {
          font-size: 36px;
          color: #34d399;
        }

        .vw-metric-unit {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 4px;
        }

        .vw-metric-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 8px;
        }

        /* ===== LEFT PANEL - Hidden (workout panel takes this space) ===== */
        .vw-left-panel {
          display: none;
        }

        .vw-info-tile {
          display: none;
        }

        .vw-info-tile__label,
        .vw-info-tile__value,
        .vw-info-tile__unit {
          display: none;
        }

        /* ===== STATS ROW - Bottom center ===== */
        .vw-stats-row {
          position: absolute;
          bottom: 20px;
          left: 50%;
          right: auto;
          transform: translateX(-50%);
          display: flex;
          gap: 28px;
          align-items: center;
          padding: 14px 24px;
          background: rgba(8, 13, 24, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 18px;
          backdrop-filter: blur(16px);
          z-index: 22;
        }

        .vw-stat-chip {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 120px;
          text-align: center;
        }

        .vw-stat-chip__label {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
        }

        .vw-stat-chip__value {
          font-size: 32px;
          font-weight: 700;
          color: #f1f5f9;
          font-variant-numeric: tabular-nums;
        }

        .vw-stat-chip__unit {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 4px;
        }

        /* ===== RIGHT PANEL - Route Map, Gradient & Elevation ===== */
        .vw-right-panel {
          position: absolute;
          top: 120px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: stretch;
          max-height: calc(100vh - 220px);
          overflow: hidden;
          z-index: 18;
        }

        .vw-route-card {
          background: rgba(5, 10, 18, 0.55);
          backdrop-filter: blur(14px);
          border-radius: 16px;
          padding: 16px 18px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          width: 260px;
          box-sizing: border-box;
        }

        .vw-route-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }

        .vw-route-label {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
        }

        .vw-route-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: rgba(226, 232, 240, 0.7);
          margin-top: 10px;
        }

        .vw-route-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: rgba(226, 232, 240, 0.75);
          margin-bottom: 10px;
        }

        .vw-route-name {
          font-size: 18px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .vw-route-canvas {
          width: 100%;
          height: 130px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          margin-bottom: 10px;
        }

        .vw-route-next {
          font-size: 13px;
          color: rgba(226, 232, 240, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .vw-route-event {
          margin-top: 8px;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          border: 1px solid rgba(148, 163, 184, 0.38);
          background: rgba(15, 23, 42, 0.52);
          color: rgba(226, 232, 240, 0.86);
        }

        .vw-route-event--zone {
          border-color: rgba(96, 165, 250, 0.5);
          background: rgba(30, 64, 175, 0.28);
          color: rgba(191, 219, 254, 0.95);
        }

        .vw-route-event--switchback {
          border-color: rgba(248, 113, 113, 0.52);
          background: rgba(127, 29, 29, 0.34);
          color: rgba(254, 202, 202, 0.95);
        }

        .vw-route-event--summit {
          border-color: rgba(251, 191, 36, 0.58);
          background: rgba(113, 63, 18, 0.36);
          color: rgba(254, 240, 138, 0.98);
        }

        .vw-route-event--idle {
          border-color: rgba(148, 163, 184, 0.3);
          background: rgba(15, 23, 42, 0.5);
          color: rgba(226, 232, 240, 0.7);
        }

        .vw-gradient-card {
          background: rgba(5, 10, 18, 0.55);
          backdrop-filter: blur(14px);
          border-radius: 16px;
          padding: 16px 18px;
          width: 260px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-sizing: border-box;
          transition: opacity 0.3s ease;
        }

        .vw-gradient-card.is-hidden {
          display: none;
        }

        .vw-gradient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .vw-gradient-label {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.65);
        }

        .vw-gradient-value {
          font-size: 32px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .vw-gradient-value--up {
          color: #f87171;
        }

        .vw-gradient-value--down {
          color: #34d399;
        }

        .vw-gradient-value--flat {
          color: #9ca3af;
        }

        .vw-gradient-visual {
          height: 14px;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 7px;
          overflow: hidden;
          position: relative;
        }

        .vw-gradient-bar {
          position: absolute;
          top: 0;
          height: 100%;
          border-radius: 7px;
          transition: all 0.3s ease;
        }

        .vw-gradient-bar--up {
          background: linear-gradient(90deg, #f59e0b, #ef4444);
          left: 50%;
        }

        .vw-gradient-bar--down {
          background: linear-gradient(90deg, #10b981, #3b82f6);
          right: 50%;
        }

        /* Elevation Profile Mini-map */
        .vw-elevation-card {
          background: rgba(5, 10, 18, 0.55);
          backdrop-filter: blur(14px);
          border-radius: 16px;
          padding: 16px 18px;
          width: 260px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-sizing: border-box;
        }

        .vw-elevation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .vw-elevation-label {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.65);
        }

        .vw-elevation-altitude {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
        }

        .vw-elevation-canvas {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
        }

        /* ===== LEFT - Workout Panel (Swift-style) ===== */
        .vw-bottom-panel {
          position: absolute;
          top: 120px;
          bottom: 130px;
          left: 20px;
          width: 260px;
          padding: 0;
          pointer-events: auto;
          z-index: 18;
        }

        .vw-workout-card {
          background: rgba(7, 12, 20, 0.2);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 14px 16px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          flex-direction: column;
          max-height: 100%;
          overflow: hidden;
        }

        .vw-workout-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .vw-workout-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
        }

        .vw-workout-timer {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
        }

        .vw-workout-progress {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .vw-workout-progress__bar {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, rgba(96, 165, 250, 0.9), rgba(59, 130, 246, 0.9));
          transition: width 0.3s ease;
        }

        /* Workout Timeline - Compact vertical list */
        .vw-workout-timeline {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
          margin: 10px 0 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }

        .vw-workout-timeline::-webkit-scrollbar {
          width: 5px;
        }

        .vw-workout-timeline::-webkit-scrollbar-track {
          background: transparent;
        }

        .vw-workout-timeline::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }

        .vw-workout-block {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.45);
          opacity: 0.6;
          transition: opacity 0.2s, background 0.2s;
          flex-shrink: 0;
        }

        .vw-workout-block--past {
          opacity: 0.3;
        }

        .vw-workout-block--active {
          opacity: 1;
          background: rgba(59, 130, 246, 0.25);
          border: 1px solid rgba(59, 130, 246, 0.45);
        }

        .vw-workout-block--future {
          opacity: 0.65;
        }

        .vw-workout-block__bar {
          width: 5px;
          height: 28px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .vw-workout-block__text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .vw-workout-block__name {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vw-workout-block__meta {
          font-size: 11px;
          color: rgba(226, 232, 240, 0.6);
        }

        .vw-workout-block__indicator {
          display: none;
        }

        /* Current Step Info */
        .vw-workout-current {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .vw-workout-current__info {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .vw-workout-current__step {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
        }

        .vw-workout-current__target {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .vw-workout-current__power {
          font-size: 22px;
          font-weight: 700;
          color: #60a5fa;
        }

        .vw-workout-current__unit {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.55);
        }

        .vw-workout-current__remaining {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
        }

        .vw-workout-next {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(226, 232, 240, 0.65);
          margin: 12px 0 10px;
        }

        /* Workout Controls */
        .vw-workout-controls {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .vw-control-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .vw-control-btn:hover {
          transform: translateY(-1px);
        }

        .vw-control-btn:active {
          transform: translateY(0);
        }

        .vw-control-btn--pause {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.5);
          color: #fbbf24;
        }

        .vw-control-btn--pause:hover {
          background: rgba(245, 158, 11, 0.3);
        }

        .vw-control-btn--resume {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.5);
          color: #34d399;
        }

        .vw-control-btn--resume:hover {
          background: rgba(16, 185, 129, 0.3);
        }

        .vw-control-btn--stop {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
        }

        .vw-control-btn--stop:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .vw-control-btn--setup {
          background: rgba(148, 163, 184, 0.16);
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #cbd5f5;
        }

        .vw-control-btn--setup:hover {
          background: rgba(148, 163, 184, 0.26);
        }

        .vw-control-btn--finish {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.5);
          color: #60a5fa;
        }

        .vw-control-btn--finish:hover {
          background: rgba(59, 130, 246, 0.3);
        }

        .vw-control-btn svg {
          width: 16px;
          height: 16px;
        }

        /* Mode indicator - hidden since metrics bar is at top now */
        .vw-mode-badge {
          display: none;
        }

        .vw-mode-badge--erg {
          background: rgba(59, 130, 246, 0.25);
          border: 1px solid rgba(59, 130, 246, 0.5);
          color: #60a5fa;
        }

        .vw-mode-badge--sim {
          background: rgba(16, 185, 129, 0.25);
          border: 1px solid rgba(16, 185, 129, 0.5);
          color: #34d399;
        }

        /* Session status when paused - high z-index to be above all */
        .vw-status-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 28px 56px;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(16px);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
          display: none;
          z-index: 240;
          pointer-events: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .vw-status-overlay--visible {
          display: block;
        }

        .vw-status-overlay__title {
          font-size: 22px;
          font-weight: 700;
          color: #fbbf24;
          margin-bottom: 8px;
        }

        .vw-status-overlay__subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* ===== BLOCK COUNTDOWN OVERLAY ===== */
        .vw-countdown-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          display: none;
          z-index: 200;
          pointer-events: none;
        }

        .vw-countdown-overlay--visible {
          display: block;
        }

        .vw-countdown-card {
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          border: 2px solid rgba(59, 130, 246, 0.5);
          padding: 32px 48px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 80px rgba(59, 130, 246, 0.2);
        }

        .vw-countdown-label {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 12px;
        }

        .vw-countdown-block-name {
          font-size: 36px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .vw-countdown-target {
          font-size: 52px;
          font-weight: 800;
          color: #60a5fa;
          margin-bottom: 16px;
          font-variant-numeric: tabular-nums;
        }

        .vw-countdown-target span {
          font-size: 28px;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 8px;
        }

        .vw-countdown-timer {
          font-size: 24px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 20px;
        }

        .vw-countdown-number {
          font-size: 120px;
          font-weight: 800;
          color: #fbbf24;
          line-height: 1;
          text-shadow: 0 0 40px rgba(251, 191, 36, 0.5);
          animation: countdown-pulse 1s ease-in-out infinite;
        }

        @keyframes countdown-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.9; }
        }

        .vw-countdown-number--hidden {
          display: none;
        }

        /* ===== HUD LAYOUT MODES ===== */
        .vw-hud[data-layout="compact"] .vw-top-bar {
          justify-content: flex-start;
          padding: 16px 20px;
        }

        .vw-hud[data-layout="compact"] .vw-metric-card {
          min-width: 82px;
          padding: 8px 12px;
        }

        .vw-hud[data-layout="compact"] .vw-metric-value {
          font-size: 24px;
        }

        .vw-hud[data-layout="compact"] .vw-metric-card--power .vw-metric-value {
          font-size: 30px;
        }

        .vw-hud[data-layout="compact"] .vw-left-panel {
          top: auto;
          bottom: 120px;
          left: 20px;
          transform: none;
          flex-direction: row;
        }

        .vw-hud[data-layout="compact"] .vw-right-panel {
          top: auto;
          bottom: 120px;
          right: 20px;
          transform: none;
          flex-direction: row;
        }

        .vw-hud[data-layout="compact"] .vw-bottom-panel {
          padding: 16px 20px;
        }

        .vw-hud[data-layout="minimal"] .vw-top-bar,
        .vw-hud[data-layout="minimal"] .vw-left-panel,
        .vw-hud[data-layout="minimal"] .vw-right-panel {
          display: none;
        }

        .vw-hud[data-layout="minimal"] .vw-bottom-panel {
          padding: 14px 16px;
        }

        /* Overlay layout - hide all HUD panels when an overlay is active */
        .vw-hud[data-layout="overlay"] .vw-top-bar,
        .vw-hud[data-layout="overlay"] .vw-stats-row,
        .vw-hud[data-layout="overlay"] .vw-right-panel,
        .vw-hud[data-layout="overlay"] .vw-bottom-panel,
        .vw-hud[data-layout="overlay"] .vw-workout-panel,
        .vw-hud[data-layout="overlay"] .vw-settings {
          display: none;
        }

        .vw-hud[data-layout="overlay"] .vw-status-overlay {
          display: block;
        }

        /* Responsive adjustments */
        @media (max-width: 1200px) {
          .vw-metric-card--power .vw-metric-value {
            font-size: 26px;
          }
          .vw-metric-value {
            font-size: 20px;
          }
        }

        @media (max-width: 900px) {
          .vw-left-panel, .vw-right-panel {
            display: none;
          }
        }
      </style>

      <div class="vw-hud" data-layout="standard">
        <!-- Settings -->
        <div class="vw-settings">
          <button class="vw-settings-toggle" id="vw-settings-toggle" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <div class="vw-settings-panel" id="vw-settings-panel">
            <div class="vw-settings-group">
              <span class="vw-settings-label">Layout</span>
              <select class="vw-settings-select" id="vw-opt-layout">
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Camera</span>
              <select class="vw-settings-select" id="vw-opt-camera">
                <option value="chase">Chase</option>
                <option value="wide">Wide</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Detail</span>
              <select class="vw-settings-select" id="vw-opt-detail">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Time of Day</span>
              <select class="vw-settings-select" id="vw-opt-time">
                <option value="day">Day</option>
                <option value="sunset">Sunset</option>
                <option value="night">Night</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Theme Pack</span>
              <select class="vw-settings-select" id="vw-opt-theme">
                <option value="classic">Classic</option>
                <option value="alpine">Alpine</option>
                <option value="coastal">Coastal</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Scenery</span>
              <select class="vw-settings-select" id="vw-opt-scenery">
                <option value="low">Low</option>
                <option value="standard" selected>Standard</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Foliage Palette</span>
              <select class="vw-settings-select" id="vw-opt-foliage-season">
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="late_summer" selected>Late Summer</option>
                <option value="autumn">Autumn</option>
                <option value="alpine_cool">Alpine Cool</option>
              </select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Route</span>
              <select class="vw-settings-select" id="vw-opt-route"></select>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Exposure</span>
              <div class="vw-settings-range-row">
                <input class="vw-settings-range" id="vw-opt-viz-exposure" type="range" min="0.8" max="2.0" step="0.01" value="1.25">
                <span id="vw-opt-viz-exposure-val">1.25</span>
              </div>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Lighting</span>
              <div class="vw-settings-range-row">
                <input class="vw-settings-range" id="vw-opt-viz-lighting" type="range" min="0.7" max="2.0" step="0.01" value="1.28">
                <span id="vw-opt-viz-lighting-val">1.28</span>
              </div>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Saturation</span>
              <div class="vw-settings-range-row">
                <input class="vw-settings-range" id="vw-opt-viz-saturation" type="range" min="0.7" max="1.8" step="0.01" value="1.18">
                <span id="vw-opt-viz-saturation-val">1.18</span>
              </div>
            </div>
            <div class="vw-settings-group">
              <span class="vw-settings-label">Haze/Fog</span>
              <div class="vw-settings-range-row">
                <input class="vw-settings-range" id="vw-opt-viz-haze" type="range" min="0.45" max="1.3" step="0.01" value="0.72">
                <span id="vw-opt-viz-haze-val">0.72</span>
              </div>
            </div>
            <div class="vw-settings-group">
              <button class="vw-settings-reset" id="vw-opt-viz-reset" type="button">Reset Visual Tuning</button>
            </div>
          </div>
        </div>

        <!-- Mode Badge -->
        <div class="vw-mode-badge vw-mode-badge--erg" id="vw-mode">ERG MODE</div>

        <!-- Top Metrics Bar -->
        <div class="vw-top-bar">
          <div class="vw-metric-card vw-metric-card--hr">
            <div class="vw-metric-label">Heart Rate</div>
            <div class="vw-metric-value">
              <span id="vw-hr">--</span>
              <span class="vw-metric-unit">bpm</span>
            </div>
          </div>

          <div class="vw-metric-card vw-metric-card--power">
            <div class="vw-metric-label">Power</div>
            <div class="vw-metric-value">
              <span id="vw-power">--</span>
              <span class="vw-metric-unit">w</span>
            </div>
            <div class="vw-metric-sub" id="vw-power-target">Target: -- W</div>
          </div>

          <div class="vw-metric-card vw-metric-card--cadence">
            <div class="vw-metric-label">Cadence</div>
            <div class="vw-metric-value">
              <span id="vw-cadence">--</span>
              <span class="vw-metric-unit">rpm</span>
            </div>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="vw-stats-row">
          <div class="vw-stat-chip">
            <span class="vw-stat-chip__label">Speed</span>
            <span class="vw-stat-chip__value">
              <span id="vw-speed">0.0</span>
              <span class="vw-stat-chip__unit">km/h</span>
            </span>
          </div>
          <div class="vw-stat-chip">
            <span class="vw-stat-chip__label">Distance</span>
            <span class="vw-stat-chip__value">
              <span id="vw-distance">0.00</span>
              <span class="vw-stat-chip__unit">km</span>
            </span>
          </div>
          <div class="vw-stat-chip">
            <span class="vw-stat-chip__label">Time</span>
            <span class="vw-stat-chip__value" id="vw-elapsed">00:00</span>
          </div>
        </div>

        <!-- Right Panel - Map, Gradient & Elevation -->
        <div class="vw-right-panel">
          <div class="vw-route-card">
            <div class="vw-route-header">
              <span class="vw-route-label">Route</span>
              <span class="vw-route-name" id="vw-route-name">Rolling Hills</span>
            </div>
            <canvas class="vw-route-canvas" id="vw-route-canvas" width="260" height="130"></canvas>
            <div class="vw-route-details">
              <span id="vw-route-total">-- km</span>
              <span id="vw-route-elevation">-- m</span>
              <span id="vw-route-difficulty">--</span>
            </div>
            <div class="vw-route-meta">
              <span id="vw-route-distance">-- km left</span>
              <span id="vw-route-lap">Lap 1</span>
            </div>
            <div class="vw-route-next" id="vw-route-next">Next turn: --</div>
            <div class="vw-route-event vw-route-event--idle" id="vw-route-event">Scenery: FLAT</div>
          </div>

          <div class="vw-gradient-card" id="vw-gradient-card">
            <div class="vw-gradient-header">
              <span class="vw-gradient-label">Gradient</span>
              <span class="vw-gradient-value vw-gradient-value--flat" id="vw-gradient">0.0%</span>
            </div>
            <div class="vw-gradient-visual">
              <div class="vw-gradient-bar" id="vw-gradient-bar"></div>
            </div>
          </div>

          <div class="vw-elevation-card">
            <div class="vw-elevation-header">
              <span class="vw-elevation-label">Elevation</span>
              <span class="vw-elevation-altitude" id="vw-altitude">0 m</span>
            </div>
            <canvas class="vw-elevation-canvas" id="vw-elevation-canvas" width="260" height="80"></canvas>
          </div>
        </div>

        <!-- Workout Panel (only shows when workout selected) -->
        <div class="vw-bottom-panel" id="vw-workout-panel">
          <div class="vw-workout-card">
        <div class="vw-workout-header">
              <div class="vw-workout-title" id="vw-workout-title">Workout</div>
              <div class="vw-workout-timer" id="vw-total-time">00:00</div>
            </div>

            <div class="vw-workout-progress">
              <div class="vw-workout-progress__bar" id="vw-workout-progress-bar"></div>
            </div>

            <div class="vw-workout-current">
              <div class="vw-workout-current__info">
                <div class="vw-workout-current__step" id="vw-step-name">--</div>
                <div class="vw-workout-current__target">
                  <span class="vw-workout-current__power" id="vw-target-power">--</span>
                  <span class="vw-workout-current__unit">W</span>
                </div>
              </div>
              <div class="vw-workout-current__remaining" id="vw-step-remaining">--:--</div>
            </div>

            <div class="vw-workout-next" id="vw-next-step">Next: --</div>

            <div class="vw-workout-timeline" id="vw-timeline"></div>

            <div class="vw-workout-controls" id="vw-controls">
              <button class="vw-control-btn vw-control-btn--pause" id="vw-btn-pause" title="Pause">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause
              </button>
              <button class="vw-control-btn vw-control-btn--resume" id="vw-btn-resume" style="display: none;" title="Resume">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Resume
              </button>
              <button class="vw-control-btn vw-control-btn--stop" id="vw-btn-stop" title="Stop Workout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                Stop
              </button>
              <button class="vw-control-btn vw-control-btn--setup" id="vw-btn-setup" title="Back to Setup">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6"></path>
                </svg>
                Setup
              </button>
            </div>
          </div>
        </div>

        <!-- Status Overlay -->
        <div class="vw-status-overlay" id="vw-status-overlay">
          <div class="vw-status-overlay__title" id="vw-status-title">PAUSED</div>
          <div class="vw-status-overlay__subtitle" id="vw-status-subtitle">Press Resume to continue</div>
        </div>

        <!-- Block Countdown Overlay -->
        <div class="vw-countdown-overlay" id="vw-countdown-overlay">
          <div class="vw-countdown-card">
            <div class="vw-countdown-label">NEXT BLOCK</div>
            <div class="vw-countdown-block-name" id="vw-countdown-block-name">Interval</div>
            <div class="vw-countdown-target" id="vw-countdown-target">240<span>W</span></div>
            <div class="vw-countdown-timer" id="vw-countdown-timer">Starting in 15s</div>
            <div class="vw-countdown-number vw-countdown-number--hidden" id="vw-countdown-number">3</div>
          </div>
        </div>
      </div>
    `;

    // Cache element references
    this.elements = {
      settingsToggle: document.getElementById('vw-settings-toggle'),
      settingsPanel: document.getElementById('vw-settings-panel'),
      optLayout: document.getElementById('vw-opt-layout'),
      optCamera: document.getElementById('vw-opt-camera'),
      optDetail: document.getElementById('vw-opt-detail'),
      optTime: document.getElementById('vw-opt-time'),
      optTheme: document.getElementById('vw-opt-theme'),
      optScenery: document.getElementById('vw-opt-scenery'),
      optFoliageSeason: document.getElementById('vw-opt-foliage-season'),
      optRoute: document.getElementById('vw-opt-route'),
      optVizExposure: document.getElementById('vw-opt-viz-exposure'),
      optVizLighting: document.getElementById('vw-opt-viz-lighting'),
      optVizSaturation: document.getElementById('vw-opt-viz-saturation'),
      optVizHaze: document.getElementById('vw-opt-viz-haze'),
      optVizExposureVal: document.getElementById('vw-opt-viz-exposure-val'),
      optVizLightingVal: document.getElementById('vw-opt-viz-lighting-val'),
      optVizSaturationVal: document.getElementById('vw-opt-viz-saturation-val'),
      optVizHazeVal: document.getElementById('vw-opt-viz-haze-val'),
      optVizReset: document.getElementById('vw-opt-viz-reset'),
      power: document.getElementById('vw-power'),
      powerTarget: document.getElementById('vw-power-target'),
      hr: document.getElementById('vw-hr'),
      cadence: document.getElementById('vw-cadence'),
      speed: document.getElementById('vw-speed'),
      distance: document.getElementById('vw-distance'),
      elapsed: document.getElementById('vw-elapsed'),
      gradientCard: document.getElementById('vw-gradient-card'),
      gradient: document.getElementById('vw-gradient'),
      gradientBar: document.getElementById('vw-gradient-bar'),
      altitude: document.getElementById('vw-altitude'),
      elevationCanvas: document.getElementById('vw-elevation-canvas'),
      routeCanvas: document.getElementById('vw-route-canvas'),
      routeName: document.getElementById('vw-route-name'),
      routeTotal: document.getElementById('vw-route-total'),
      routeElevation: document.getElementById('vw-route-elevation'),
      routeDifficulty: document.getElementById('vw-route-difficulty'),
      routeDistance: document.getElementById('vw-route-distance'),
      routeLap: document.getElementById('vw-route-lap'),
      routeNext: document.getElementById('vw-route-next'),
      routeEvent: document.getElementById('vw-route-event'),
      totalTime: document.getElementById('vw-total-time'),
      workoutTitle: document.getElementById('vw-workout-title'),
      workoutPanel: document.getElementById('vw-workout-panel'),
      workoutProgressBar: document.getElementById('vw-workout-progress-bar'),
      timeline: document.getElementById('vw-timeline'),
      stepName: document.getElementById('vw-step-name'),
      targetPower: document.getElementById('vw-target-power'),
      stepRemaining: document.getElementById('vw-step-remaining'),
      nextStep: document.getElementById('vw-next-step'),
      mode: document.getElementById('vw-mode'),
      statusOverlay: document.getElementById('vw-status-overlay'),
      statusTitle: document.getElementById('vw-status-title'),
      statusSubtitle: document.getElementById('vw-status-subtitle'),
      btnPause: document.getElementById('vw-btn-pause'),
      btnResume: document.getElementById('vw-btn-resume'),
      btnStop: document.getElementById('vw-btn-stop'),
      btnSetup: document.getElementById('vw-btn-setup'),
      controls: document.getElementById('vw-controls'),
      countdownOverlay: document.getElementById('vw-countdown-overlay'),
      countdownBlockName: document.getElementById('vw-countdown-block-name'),
      countdownTarget: document.getElementById('vw-countdown-target'),
      countdownTimer: document.getElementById('vw-countdown-timer'),
      countdownNumber: document.getElementById('vw-countdown-number')
    };

    // Initialize elevation canvas
    this.elevationCtx = this.elements.elevationCanvas.getContext('2d');
    this.drawElevationProfile([]);

    // Initialize route canvas
    this.routeCtx = this.elements.routeCanvas.getContext('2d');
    this.drawRouteMap([]);

    // Setup control buttons
    this.setupControls();
    this.setupSettings();

    if (this.elements.workoutPanel) {
      this.elements.workoutPanel.style.display = 'none';
    }
  }

  setupControls() {
    this.elements.btnPause.addEventListener('click', () => {
      if (this.onControl) this.onControl('pause');
    });

    this.elements.btnResume.addEventListener('click', () => {
      if (this.onControl) this.onControl('resume');
    });

    this.elements.btnStop.addEventListener('click', () => {
      if (this.onControl) this.onControl('stop');
    });

    if (this.elements.btnSetup) {
      this.elements.btnSetup.addEventListener('click', () => {
        if (this.onControl) this.onControl('setup');
      });
    }
  }

  setupSettings() {
    if (this.elements.settingsToggle) {
      this.elements.settingsToggle.addEventListener('click', () => {
        this.elements.settingsPanel.classList.toggle('is-open');
      });
    }

    const bindSelect = (el, key) => {
      if (!el) return;
      el.addEventListener('change', (event) => {
        if (this.onOptionChange) {
          this.onOptionChange(key, event.target.value);
        }
      });
    };

    bindSelect(this.elements.optLayout, 'layout');
    bindSelect(this.elements.optCamera, 'camera');
    bindSelect(this.elements.optDetail, 'detail');
    bindSelect(this.elements.optTime, 'time');
    bindSelect(this.elements.optTheme, 'theme');
    bindSelect(this.elements.optScenery, 'scenery');
    bindSelect(this.elements.optFoliageSeason, 'foliage_season');
    bindSelect(this.elements.optRoute, 'route');

    const bindRange = (el, valueEl, key) => {
      if (!el) return;
      const syncLabel = () => {
        if (valueEl) valueEl.textContent = Number(el.value).toFixed(2);
      };
      syncLabel();
      el.addEventListener('input', (event) => {
        syncLabel();
        if (this.onOptionChange) {
          this.onOptionChange(key, Number(event.target.value));
        }
      });
    };

    bindRange(this.elements.optVizExposure, this.elements.optVizExposureVal, 'viz_exposure');
    bindRange(this.elements.optVizLighting, this.elements.optVizLightingVal, 'viz_lighting');
    bindRange(this.elements.optVizSaturation, this.elements.optVizSaturationVal, 'viz_saturation');
    bindRange(this.elements.optVizHaze, this.elements.optVizHazeVal, 'viz_haze');

    if (this.elements.optVizReset) {
      this.elements.optVizReset.addEventListener('click', () => {
        const defaults = {
          exposure: 1.25,
          lighting: 1.28,
          saturation: 1.18,
          haze: 0.72
        };
        if (this.elements.optVizExposure) this.elements.optVizExposure.value = String(defaults.exposure);
        if (this.elements.optVizLighting) this.elements.optVizLighting.value = String(defaults.lighting);
        if (this.elements.optVizSaturation) this.elements.optVizSaturation.value = String(defaults.saturation);
        if (this.elements.optVizHaze) this.elements.optVizHaze.value = String(defaults.haze);
        if (this.elements.optVizExposureVal) this.elements.optVizExposureVal.textContent = defaults.exposure.toFixed(2);
        if (this.elements.optVizLightingVal) this.elements.optVizLightingVal.textContent = defaults.lighting.toFixed(2);
        if (this.elements.optVizSaturationVal) this.elements.optVizSaturationVal.textContent = defaults.saturation.toFixed(2);
        if (this.elements.optVizHazeVal) this.elements.optVizHazeVal.textContent = defaults.haze.toFixed(2);
        if (this.onOptionChange) {
          this.onOptionChange('viz_reset', true);
        }
      });
    }
  }

  setLayout(layout) {
    const root = this.container.querySelector('.vw-hud');
    if (root) {
      this.userLayout = layout || 'standard';
      root.dataset.layout = layout || 'standard';
    }
  }

  setRouteOptions(routes = [], currentRouteId = '') {
    if (!this.elements.optRoute) return;
    this.elements.optRoute.innerHTML = routes
      .map(route => `<option value="${route.id}">${route.name}</option>`)
      .join('');
    if (currentRouteId) {
      this.elements.optRoute.value = currentRouteId;
    }
  }

  setElevationProfile(profile = []) {
    this.drawElevationProfile(profile);
  }

  setRouteMap(routeMap = {}) {
    this.routeMap = routeMap;
    if (routeMap?.routeName && this.elements.routeName) {
      this.elements.routeName.textContent = routeMap.routeName;
    }
    if (this.elements.routeTotal && routeMap?.totalDistance) {
      this.elements.routeTotal.textContent = `${(routeMap.totalDistance / 1000).toFixed(1)} km`;
    } else if (this.elements.routeTotal) {
      this.elements.routeTotal.textContent = '-- km';
    }
    if (this.elements.routeElevation && routeMap?.totalElevation !== null && routeMap?.totalElevation !== undefined) {
      this.elements.routeElevation.textContent = `${Math.round(routeMap.totalElevation)} m`;
    } else if (this.elements.routeElevation) {
      this.elements.routeElevation.textContent = '-- m';
    }
    if (this.elements.routeDifficulty) {
      this.elements.routeDifficulty.textContent = routeMap?.difficulty
        ? routeMap.difficulty.toUpperCase()
        : '--';
    }
    this.updateRouteMapPosition(this.lastRouteDistance || 0, null);
  }

  update(state) {
    this.lastRouteDistance = state.distance || 0;
    // Update main metrics
    this.elements.power.textContent = state.power > 0 ? Math.round(state.power) : '--';
    this.elements.hr.textContent = state.heartRate > 0 ? Math.round(state.heartRate) : '--';
    this.elements.cadence.textContent = state.cadence > 0 ? Math.round(state.cadence) : '--';
    this.elements.speed.textContent = state.speed > 0 ? state.speed.toFixed(1) : '0.0';
    this.elements.distance.textContent = ((state.distance || 0) / 1000).toFixed(2);
    this.elements.elapsed.textContent = formatDuration(state.elapsed);
    this.elements.totalTime.textContent = formatDuration(state.elapsed);

    const hasWorkout = Boolean(state.workoutSelected) && Array.isArray(state.workoutSteps) && state.workoutSteps.length > 0;
    if (this.elements.workoutPanel) {
      this.elements.workoutPanel.style.display = hasWorkout ? 'block' : 'none';
    }
    if (this.elements.workoutTitle) {
      this.elements.workoutTitle.textContent = state.workoutName || 'Workout';
    }

    // Update target power display
    if (state.currentStep?.targetPower) {
      this.elements.powerTarget.textContent = `Target: ${state.currentStep.targetPower} W`;
    } else {
      this.elements.powerTarget.textContent = 'Target: -- W';
    }

    // Update gradient - only show card when there's actual gradient
    const rawGradientPercent = (state.gradient || 0) * 100;
    const maxGradientPercent = REALISTIC_GRADIENT_LIMIT * 100;
    const clampedGradientPercent = Math.max(-maxGradientPercent, Math.min(maxGradientPercent, rawGradientPercent));
    const gradientPercent = Math.abs(clampedGradientPercent) < 0.15 ? 0 : clampedGradientPercent;
    const hasSignificantGradient = Math.abs(gradientPercent) >= 0.8;
    const gradientDisplay = `${gradientPercent >= 0 ? '+' : ''}${gradientPercent.toFixed(1)}%`;
    this.elements.gradient.textContent = gradientDisplay;

    if (this.elements.gradientCard) {
      if (hasSignificantGradient) {
        this.elements.gradientCard.classList.remove('is-hidden');
        this.elements.gradientCard.style.display = 'block';
      } else {
        this.elements.gradientCard.classList.add('is-hidden');
        this.elements.gradientCard.style.display = 'none';
      }
    }

    // Update gradient styling
    if (gradientPercent > 0.8) {
      this.elements.gradient.className = 'vw-gradient-value vw-gradient-value--up';
      this.elements.gradientBar.className = 'vw-gradient-bar vw-gradient-bar--up';
      this.elements.gradientBar.style.width = `${Math.min(50, gradientPercent * 2.4)}%`;
      this.elements.gradientBar.style.left = '50%';
      this.elements.gradientBar.style.right = 'auto';
    } else if (gradientPercent < -0.8) {
      this.elements.gradient.className = 'vw-gradient-value vw-gradient-value--down';
      this.elements.gradientBar.className = 'vw-gradient-bar vw-gradient-bar--down';
      this.elements.gradientBar.style.width = `${Math.min(50, Math.abs(gradientPercent) * 2.4)}%`;
      this.elements.gradientBar.style.left = 'auto';
      this.elements.gradientBar.style.right = '50%';
    } else {
      this.elements.gradient.className = 'vw-gradient-value vw-gradient-value--flat';
      this.elements.gradientBar.style.width = '0%';
    }

    // Update altitude
    this.elements.altitude.textContent = `${Math.round(state.altitude || 0)} m`;

    // Update mode
    if (state.mode === 'sim') {
      this.elements.mode.textContent = 'SIM MODE';
      this.elements.mode.className = 'vw-mode-badge vw-mode-badge--sim';
    } else {
      this.elements.mode.textContent = 'ERG MODE';
      this.elements.mode.className = 'vw-mode-badge vw-mode-badge--erg';
    }

    // Update workout timeline
    if (hasWorkout) {
      this.updateWorkoutTimeline(state);
    }

    // Update current step
    if (state.currentStep) {
      this.elements.stepName.textContent = state.currentStep.label || '--';
      this.elements.targetPower.textContent = state.currentStep.targetPower || '--';
      this.elements.stepRemaining.textContent = formatDuration(state.stepRemaining);
    }

    if (this.elements.workoutProgressBar) {
      const progress = Math.max(0, Math.min(1, state.totalProgress || 0));
      this.elements.workoutProgressBar.style.width = `${progress * 100}%`;
    }

    if (this.elements.nextStep && hasWorkout) {
      const currentIndex = state.workoutSteps.findIndex(step => step.id === state.currentStep?.id);
      const nextStep = state.workoutSteps[currentIndex + 1];
      this.elements.nextStep.textContent = nextStep
        ? `Next: ${nextStep.label || 'Block'} · ${nextStep.targetPower || '--'}W · ${formatDuration(nextStep.durationSec)}`
        : 'Next: Finish';
    }

    // Update session state (paused overlay & buttons)
    this.updateSessionState(state.sessionState);

    // Update block countdown overlay
    this.updateBlockCountdown(state);

    // Update elevation profile position
    if (state.distance > 0) {
      this.updateElevationPosition(state.distance, state.altitude);
    }

    // Update route map position
    if (state.distance >= 0) {
      this.updateRouteMapPosition(state.distance, state.turnPreview);
    }

    if (this.routeMap?.totalDistance && this.elements.routeDistance && this.elements.routeLap) {
      const total = this.routeMap.totalDistance;
      const progress = total > 0 ? ((state.distance || 0) % total) : 0;
      const remaining = Math.max(0, total - progress);
      this.elements.routeDistance.textContent = `${(remaining / 1000).toFixed(1)} km left`;
      this.elements.routeLap.textContent = `Lap ${Math.floor((state.distance || 0) / total) + 1}`;
    } else if (this.elements.routeDistance && this.elements.routeLap) {
      this.elements.routeDistance.textContent = '-- km left';
      this.elements.routeLap.textContent = 'Lap --';
    }

    if (this.elements.routeNext) {
      if (state.turnPreview?.distanceMeters !== null && state.turnPreview?.distanceMeters !== undefined) {
        const km = (state.turnPreview.distanceMeters / 1000).toFixed(1);
        const dir = state.turnPreview.direction === 'left' ? 'Left' : 'Right';
        this.elements.routeNext.textContent = `Next turn: ${dir} in ${km} km`;
      } else {
        this.elements.routeNext.textContent = 'Next turn: --';
      }
    }

    if (this.elements.routeEvent) {
      if (state.routeEvent?.title) {
        const type = state.routeEvent.type || 'zone';
        const allowedType = ['zone', 'switchback', 'summit'].includes(type) ? type : 'zone';
        this.elements.routeEvent.className = `vw-route-event vw-route-event--${allowedType}`;
        this.elements.routeEvent.textContent = state.routeEvent.title;
      } else {
        const zoneLabel = (state.sceneryZone || 'flat').replace('-', ' ').toUpperCase();
        this.elements.routeEvent.className = 'vw-route-event vw-route-event--idle';
        this.elements.routeEvent.textContent = `Scenery: ${zoneLabel}`;
      }
    }

  }

  updateSessionState(sessionState) {
    const isPaused = sessionState === 'paused';
    const isRunning = sessionState === 'running';
    const overlayActive = isPaused || sessionState === 'waiting' || sessionState === 'connecting';

    if (this.elements.statusTitle && this.elements.statusSubtitle) {
      if (sessionState === 'waiting') {
        this.elements.statusTitle.textContent = 'WAITING FOR SESSION';
        this.elements.statusSubtitle.textContent = 'Start a workout to begin';
      } else if (sessionState === 'connecting') {
        this.elements.statusTitle.textContent = 'CONNECTING';
        this.elements.statusSubtitle.textContent = 'Establishing trainer connection';
      } else if (sessionState === 'paused') {
        this.elements.statusTitle.textContent = 'PAUSED';
        this.elements.statusSubtitle.textContent = 'Press Resume to continue';
      } else {
        this.elements.statusTitle.textContent = '';
        this.elements.statusSubtitle.textContent = '';
      }
    }

    if (this.elements.statusOverlay) {
      if (overlayActive) {
        this.elements.statusOverlay.classList.add('vw-status-overlay--visible');
      } else {
        this.elements.statusOverlay.classList.remove('vw-status-overlay--visible');
      }
    }

    // Auto reflow HUD when any overlay is active
    const root = this.container.querySelector('.vw-hud');
    if (root) {
      if (overlayActive) {
        root.dataset.layout = 'overlay';
      } else if (this.userLayout) {
        root.dataset.layout = this.userLayout;
      } else {
        root.dataset.layout = 'standard';
      }
    }

    // Toggle buttons
    this.elements.btnPause.style.display = isRunning ? 'flex' : 'none';
    this.elements.btnResume.style.display = isPaused ? 'flex' : 'none';
    this.elements.btnStop.style.display = (isRunning || isPaused) ? 'flex' : 'none';
  }

  updateBlockCountdown(state) {
    const { countdownOverlay, countdownBlockName, countdownTarget, countdownTimer, countdownNumber } = this.elements;
    if (!countdownOverlay) return;

    // Only show countdown during running session with a workout
    if (state.sessionState !== 'running' || !state.workoutSteps?.length || !state.currentStep) {
      countdownOverlay.classList.remove('vw-countdown-overlay--visible');
      return;
    }

    const currentIndex = state.workoutSteps.findIndex(s => s.id === state.currentStep?.id);
    const nextStep = state.workoutSteps[currentIndex + 1];
    const stepRemaining = state.stepRemaining || 0;

    // Show countdown if:
    // 1. There is a next step
    // 2. Current step has 20 seconds or less remaining
    // 3. Next step has different target power
    const shouldShowCountdown = nextStep && stepRemaining <= 20 && stepRemaining > 0;

    if (shouldShowCountdown) {
      countdownOverlay.classList.add('vw-countdown-overlay--visible');

      // Update block name and target
      countdownBlockName.textContent = nextStep.label || 'Next Block';
      countdownTarget.innerHTML = `${nextStep.targetPower || '--'}<span>W</span>`;

      // Show countdown number for last 3 seconds, otherwise show timer
      if (stepRemaining <= 3) {
        countdownTimer.style.display = 'none';
        countdownNumber.classList.remove('vw-countdown-number--hidden');
        countdownNumber.textContent = Math.ceil(stepRemaining);
      } else {
        countdownTimer.style.display = 'block';
        countdownNumber.classList.add('vw-countdown-number--hidden');
        countdownTimer.textContent = `Starting in ${Math.ceil(stepRemaining)}s`;
      }
    } else {
      countdownOverlay.classList.remove('vw-countdown-overlay--visible');
    }
  }

  updateWorkoutTimeline(state) {
    const steps = state.workoutSteps;
    const currentIndex = steps.findIndex(s => s.id === state.currentStep?.id);

    // Only rebuild if steps changed
    const stepsKey = steps.map(s => s.id).join(',');
    if (this.lastStepsKey !== stepsKey) {
      this.lastStepsKey = stepsKey;

      this.elements.timeline.innerHTML = steps.map((step, index) => {
        const color = this.getZoneColor(step.zone || step.targetPower);
        const duration = formatDuration(step.durationSec);
        return `
          <div class="vw-workout-block" data-index="${index}">
            <div class="vw-workout-block__bar" style="background: ${color};"></div>
            <div class="vw-workout-block__text">
              <div class="vw-workout-block__name">${step.label || 'Block'}</div>
              <div class="vw-workout-block__meta">${step.targetPower || '--'}W · ${duration}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Update active states
    const blockEls = this.elements.timeline.querySelectorAll('.vw-workout-block');
    blockEls.forEach((el, index) => {
      el.classList.remove('vw-workout-block--past', 'vw-workout-block--active', 'vw-workout-block--future');
      if (index < currentIndex) {
        el.classList.add('vw-workout-block--past');
      } else if (index === currentIndex) {
        el.classList.add('vw-workout-block--active');
      } else {
        el.classList.add('vw-workout-block--future');
      }
    });
  }

  getZoneColor(zoneOrPower) {
    const zoneColors = {
      'Z1': '#94a3b8',
      'Z2': '#60a5fa',
      'Z3': '#4ade80',
      'Z4': '#fbbf24',
      'Z5': '#f97316',
      'Z6': '#ef4444',
      'Z7': '#a855f7'
    };

    if (typeof zoneOrPower === 'string' && zoneColors[zoneOrPower]) {
      return zoneColors[zoneOrPower];
    }

    const power = Number(zoneOrPower) || 0;
    if (power < 140) return zoneColors['Z1'];
    if (power < 190) return zoneColors['Z2'];
    if (power < 230) return zoneColors['Z3'];
    if (power < 260) return zoneColors['Z4'];
    if (power < 300) return zoneColors['Z5'];
    if (power < 350) return zoneColors['Z6'];
    return zoneColors['Z7'];
  }

  drawElevationProfile(elevationData) {
    const canvas = this.elements.elevationCanvas;
    const ctx = this.elevationCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, 0, width, height);

    if (!elevationData || elevationData.length < 2) {
      // Draw placeholder
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.7);
      for (let i = 0; i < width; i += 10) {
        ctx.lineTo(i, height * 0.7 + Math.sin(i * 0.05) * 10);
      }
      ctx.stroke();
      return;
    }

    // Find min/max altitude
    const altitudes = elevationData.map(p => p.altitude);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const range = maxAlt - minAlt || 1;

    // Draw elevation line
    ctx.beginPath();
    ctx.moveTo(0, height);

    elevationData.forEach((point, i) => {
      const x = (i / (elevationData.length - 1)) * width;
      const y = height - ((point.altitude - minAlt) / range) * (height - 10) - 5;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(width, height);
    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line on top
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    elevationData.forEach((point, i) => {
      const x = (i / (elevationData.length - 1)) * width;
      const y = height - ((point.altitude - minAlt) / range) * (height - 10) - 5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    this.elevationData = elevationData;
  }

  drawRouteMap(points) {
    const canvas = this.elements.routeCanvas;
    const ctx = this.routeCtx;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, 'rgba(26, 39, 35, 0.96)');
    bg.addColorStop(0.52, 'rgba(22, 33, 31, 0.95)');
    bg.addColorStop(1, 'rgba(17, 27, 25, 0.97)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle terrain-like contour lines to mimic map tiles.
    ctx.strokeStyle = 'rgba(200, 214, 206, 0.08)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 9; row += 1) {
      const y = (row / 8) * height;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const wave = Math.sin((x * 0.055) + row * 0.8) * 2.6;
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    const gridStep = 26;
    for (let x = gridStep; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridStep; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!points || points.length < 2) {
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.3)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(12, height * 0.55);
      ctx.lineTo(width - 12, height * 0.45);
      ctx.stroke();
      return;
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const altitudes = points.map(p => p.altitude ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const altRange = maxAlt - minAlt || 1;

    const padding = 12;
    this.routeMapBounds = { minX, maxX, minY, maxY, rangeX, rangeY, padding };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    points.forEach((p, i) => {
      const { x, y } = this.routePointToCanvas(p, this.routeMapBounds, width, height);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.strokeStyle = this.routeMap?.color || 'rgba(96, 165, 250, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    points.forEach((p, i) => {
      const { x, y } = this.routePointToCanvas(p, this.routeMapBounds, width, height);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Segment overlay uses climb/descent tint for GPX-like readability.
    const routeColor = this.routeMap?.color || '#60a5fa';
    ctx.lineWidth = 2.2;
    for (let i = 1; i < points.length; i += 1) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const climb = (p1.altitude || 0) - (p0.altitude || 0);
      if (climb > altRange * 0.01) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
      } else if (climb < -altRange * 0.01) {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
      } else {
        ctx.strokeStyle = routeColor;
      }
      const a = this.routePointToCanvas(p0, this.routeMapBounds, width, height);
      const b = this.routePointToCanvas(p1, this.routeMapBounds, width, height);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    points.forEach((p, i) => {
      const { x, y } = this.routePointToCanvas(p, this.routeMapBounds, width, height);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const startCanvas = this.routePointToCanvas(startPoint, this.routeMapBounds, width, height);
    const endCanvas = this.routePointToCanvas(endPoint, this.routeMapBounds, width, height);
    const startX = startCanvas.x;
    const startY = startCanvas.y;
    const endX = endCanvas.x;
    const endY = endCanvas.y;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(startX, startY, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.beginPath();
    ctx.arc(startX, startY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(endX, endY, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    ctx.fill();

    const turns = this.routeMap?.turns || [];
    if (turns.length) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
      turns.forEach(turn => {
        const match = points.find(p => Math.abs(p.distance - turn.distance) < this.routeMap.totalDistance / points.length);
        if (!match) return;
        const { x, y } = this.routePointToCanvas(match, this.routeMapBounds, width, height);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  routePointToCanvas(point, bounds, width, height) {
    if (!point || !bounds) {
      return { x: 0, y: 0 };
    }
    const padding = bounds.padding ?? 10;
    return {
      x: padding + ((point.x - bounds.minX) / bounds.rangeX) * (width - padding * 2),
      y: padding + ((point.y - bounds.minY) / bounds.rangeY) * (height - padding * 2)
    };
  }

  drawRouteMiniMapBackground(width, height) {
    const ctx = this.routeCtx;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, 'rgba(26, 39, 35, 0.96)');
    bg.addColorStop(0.52, 'rgba(22, 33, 31, 0.95)');
    bg.addColorStop(1, 'rgba(17, 27, 25, 0.97)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(200, 214, 206, 0.08)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 8; row += 1) {
      const y = ((row + 0.5) / 8) * height;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const wave = Math.sin((x * 0.055) + row * 0.84) * 2.2;
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    const gridStep = 26;
    for (let x = gridStep; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridStep; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  getSignedRouteDelta(targetDistance, currentDistance, totalDistance) {
    let delta = (targetDistance - currentDistance + totalDistance) % totalDistance;
    if (delta > totalDistance * 0.5) {
      delta -= totalDistance;
    }
    return delta;
  }

  updateRouteMapPosition(distanceMeters = 0, turnPreview = null) {
    if (!this.routeMap?.points || this.routeMap.points.length < 2) return;
    const { points } = this.routeMap;
    const canvas = this.elements.routeCanvas;
    const ctx = this.routeCtx;
    const width = canvas.width;
    const height = canvas.height;
    const totalDistance = this.routeMap.totalDistance || 1;
    const progress = ((distanceMeters % totalDistance) + totalDistance) % totalDistance / totalDistance;
    const currentIndex = Math.floor(progress * (points.length - 1));
    const currentPoint = points[currentIndex];
    const nextPoint = points[Math.min(points.length - 1, currentIndex + 1)];
    if (!currentPoint || !nextPoint) return;

    this.drawRouteMiniMapBackground(width, height);
    const lookAheadMeters = 2200;
    const lookBehindMeters = 220;
    const lateralRangeMeters = 300;

    const headingVector = {
      x: nextPoint.x - currentPoint.x,
      y: nextPoint.y - currentPoint.y
    };
    const headingLength = Math.hypot(headingVector.x, headingVector.y) || 1;
    const dir = {
      x: headingVector.x / headingLength,
      y: headingVector.y / headingLength
    };
    const right = {
      x: dir.y,
      y: -dir.x
    };

    const currentDistance = currentPoint.distance ?? (progress * totalDistance);
    const localPoints = [];
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const deltaDistance = this.getSignedRouteDelta(point.distance ?? 0, currentDistance, totalDistance);
      if (deltaDistance < -lookBehindMeters || deltaDistance > lookAheadMeters) continue;

      const dx = point.x - currentPoint.x;
      const dy = point.y - currentPoint.y;
      const lateral = dx * right.x + dy * right.y;
      const mapX = width * 0.5 + (lateral / lateralRangeMeters) * (width * 0.42);
      const mapY = height * 0.88 - (deltaDistance / lookAheadMeters) * (height * 0.8);

      if (mapX < -30 || mapX > width + 30 || mapY < -30 || mapY > height + 30) continue;
      localPoints.push({ ...point, deltaDistance, mapX, mapY });
    }

    localPoints.sort((a, b) => a.deltaDistance - b.deltaDistance);
    if (localPoints.length < 2) return;

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    localPoints.forEach((p, i) => {
      const x = p.mapX;
      const y = p.mapY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const routeColor = this.routeMap?.color || 'rgba(248, 250, 252, 0.9)';
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    localPoints.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.mapX, p.mapY);
      } else {
        ctx.lineTo(p.mapX, p.mapY);
      }
    });
    ctx.stroke();

    // Current position dot
    const cx = width * 0.5;
    const cy = height * 0.88;

    // Pulsing ring around current position
    const pulse = (Math.sin(Date.now() / 320) + 1) / 2;
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.2 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    const heading = -Math.PI / 2;
    const arrowSize = 6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);
    ctx.fillStyle = 'rgba(96, 165, 250, 0.9)';
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.5);
    ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (turnPreview?.distanceMeters !== null && turnPreview?.distanceMeters !== undefined) {
      const targetDistance = distanceMeters + turnPreview.distanceMeters;
      const totalDistance = this.routeMap.totalDistance || 1;
      const progressTarget = (targetDistance % totalDistance) / totalDistance;
      const targetIndex = Math.min(points.length - 1, Math.max(0, Math.round(progressTarget * (points.length - 1))));
      const targetPoint = points[targetIndex];
      if (targetPoint) {
        const targetDelta = this.getSignedRouteDelta(targetPoint.distance ?? 0, currentDistance, totalDistance);
        const tdx = targetPoint.x - currentPoint.x;
        const tdy = targetPoint.y - currentPoint.y;
        const tlateral = tdx * right.x + tdy * right.y;
        const tx = width * 0.5 + (tlateral / lateralRangeMeters) * (width * 0.42);
        const ty = height * 0.88 - (targetDelta / lookAheadMeters) * (height * 0.8);

        if (targetDelta < -lookBehindMeters || targetDelta > lookAheadMeters || tx < -20 || tx > width + 20 || ty < -20 || ty > height + 20) {
          return;
        }

        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        const ringPulse = (Math.sin(Date.now() / 260) + 1) / 2;
        ctx.strokeStyle = `rgba(248, 113, 113, ${0.25 + ringPulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 5 + ringPulse * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(248, 113, 113, 0.9)';
        ctx.beginPath();
        ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updateElevationPosition(_distance, _altitude) {
    // This could be enhanced to show current position on the elevation profile
    // For now, just store the data
  }

  resize() {
    // Handle any resize-specific updates
  }
}
