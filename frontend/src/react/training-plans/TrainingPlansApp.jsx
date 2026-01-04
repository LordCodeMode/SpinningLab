import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../../../static/js/core/api.js';
import { notify } from '../../../static/js/utils/notifications.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/training-plans/config.js';

const PLAN_START_STORAGE_KEY = 'training_plan_start_date';

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getToday = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

const formatWeekSession = (session) => {
  if (!session) return 'Rest';
  if (typeof session === 'string' && session.includes('|')) {
    const [, name] = session.split('|', 2);
    return name?.trim() || session;
  }
  return session;
};

const formatDateLabel = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const parseWeekStructure = (structure) => {
  if (!structure) return [];
  return Array.isArray(structure[0]) ? structure[0] : structure;
};

const getSessionCategory = (session) => {
  if (!session) return 'rest';
  const label = String(session).toLowerCase();
  if (label.includes('rest')) return 'rest';
  if (label.includes('recovery')) return 'recovery';
  if (label.includes('vo2')) return 'vo2';
  if (label.includes('threshold')) return 'threshold';
  if (label.includes('sweet')) return 'sweet';
  if (label.includes('sprint') || label.includes('anaerobic')) return 'sprint';
  if (label.includes('tempo')) return 'tempo';
  if (label.includes('endurance') || label.includes('base')) return 'endurance';
  return 'endurance';
};

const getTemplateTone = (template, focus) => {
  const label = `${template?.plan_type || ''} ${template?.name || ''}`.toLowerCase();
  if (label.includes('recovery') || label.includes('rest')) return 'tone-recovery';
  if (label.includes('peak') || focus === 'sprint' || focus === 'vo2') return 'tone-peak';
  if (label.includes('build') || focus === 'threshold') return 'tone-build';
  return 'tone-base';
};

const getFocusFromWeek = (weekData) => {
  const counts = weekData.reduce((acc, session) => {
    const category = getSessionCategory(session);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts).filter(([key]) => key !== 'rest');
  if (!entries.length) return 'endurance';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const getWeekStats = (weekData) => {
  const totalSessions = weekData.filter(Boolean).length;
  const focus = getFocusFromWeek(weekData);
  return {
    totalSessions,
    focus
  };
};

const computePlanProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const today = new Date();
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(Math.max(today.getTime() - start.getTime(), 0), total);
  return Math.round((elapsed / total) * 100);
};

export default function TrainingPlansApp() {
  const templatesRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [startDate, setStartDate] = useState(localStorage.getItem(PLAN_START_STORAGE_KEY) || getToday());
  const [planName, setPlanName] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) || null,
    [templates, activeTemplateId]
  );

  const weekPreview = useMemo(() => parseWeekStructure(activeTemplate?.week_structure || []), [activeTemplate]);

  const planTypes = useMemo(() => {
    const types = templates.map((template) => template.plan_type).filter(Boolean);
    return ['All', ...Array.from(new Set(types))];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'All') return templates;
    return templates.filter((template) => template.plan_type === activeFilter);
  }, [templates, activeFilter]);

  const activePlan = useMemo(() => plans.find((plan) => plan.is_active) || null, [plans]);

  const nextPlanStart = useMemo(() => {
    const sorted = plans
      .filter((plan) => plan.start_date)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    return sorted[0]?.start_date || null;
  }, [plans]);

  const fetchData = useCallback(async () => {
    const [templateData, planData] = await Promise.all([
      API.getTrainingPlanTemplates(),
      API.getTrainingPlans(),
    ]);
    setTemplates(templateData || []);
    setPlans(planData || []);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        await fetchData();
      } catch (error) {
        console.error('[TrainingPlansReact] load failed:', error);
        notify(`Failed to load training plans: ${error.message}`, 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const handleCreatePlan = async (templateId) => {
    if (!startDate) {
      notify('Please select a start date', 'warning');
      return;
    }

    try {
      setActionBusy(true);
      const payload = {
        template_id: templateId,
        start_date: startDate,
        name: planName || null,
        is_active: true,
      };

      const response = await API.createTrainingPlan(payload);
      const missing = response?.missing_workout_types || [];

      if (response?.scheduled_workouts === 0) {
        notify('Plan created, but no matching template workouts were found.', 'warning');
      } else {
        notify('Training plan scheduled successfully', 'success');
      }

      if (missing.length) {
        notify(`Missing workout templates: ${missing.join(', ')}`, 'info');
      }

      setIsModalOpen(false);
      setActiveTemplateId(null);

      if (response?.scheduled_workouts > 0) {
        localStorage.setItem(PLAN_START_STORAGE_KEY, startDate);
        setTimeout(() => {
          const query = `?start=${encodeURIComponent(startDate)}&view=month`;
          window.location.hash = `#/calendar${query}`;
        }, 350);
        return;
      }

      await fetchData();
    } catch (error) {
      console.error('[TrainingPlansReact] create plan failed:', error);
      notify(`Failed to create training plan: ${error.message}`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSetActivePlan = async (planId, planStart) => {
    try {
      setActionBusy(true);
      await API.updateTrainingPlan(planId, { is_active: true });
      notify('Active plan updated', 'success');
      if (planStart) {
        localStorage.setItem(PLAN_START_STORAGE_KEY, planStart);
      }
      await fetchData();
    } catch (error) {
      console.error('[TrainingPlansReact] set active plan failed:', error);
      notify(`Failed to update plan: ${error.message}`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm('Delete this training plan? This will remove it from your list.')) {
      return;
    }
    try {
      setActionBusy(true);
      await API.deleteTrainingPlan(planId);
      notify('Training plan deleted', 'success');
      await fetchData();
    } catch (error) {
      console.error('[TrainingPlansReact] delete plan failed:', error);
      notify(`Failed to delete training plan: ${error.message}`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRegeneratePlan = async (planId, planStart) => {
    const selectedStart = startDate;
    let nextStart = planStart || selectedStart;

    if (!nextStart) {
      notify('Please select a start date to regenerate the plan', 'warning');
      return;
    }

    if (planStart && selectedStart && planStart !== selectedStart) {
      const useSelected = confirm(`Use ${selectedStart} as the new start date for this plan?`);
      if (useSelected) {
        nextStart = selectedStart;
      }
    }

    if (!confirm('Regenerate this plan and reschedule its workouts?')) {
      return;
    }

    try {
      setActionBusy(true);
      const response = await API.regenerateTrainingPlan(planId, { start_date: nextStart });
      const missing = response?.missing_workout_types || [];

      if (response?.scheduled_workouts === 0) {
        notify('Plan regenerated, but no matching template workouts were found.', 'warning');
      } else {
        notify('Training plan regenerated successfully', 'success');
      }

      if (missing.length) {
        notify(`Missing workout templates: ${missing.join(', ')}`, 'info');
      }

      if (nextStart) {
        localStorage.setItem(PLAN_START_STORAGE_KEY, nextStart);
      }

      await fetchData();
    } catch (error) {
      console.error('[TrainingPlansReact] regenerate plan failed:', error);
      notify(`Failed to regenerate training plan: ${error.message}`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleViewCalendar = (planStart) => {
    const query = planStart ? `?start=${encodeURIComponent(planStart)}&view=month` : '?view=month';
    window.location.hash = `#/calendar${query}`;
  };

  const handleSwitchToClassic = () => {
    localStorage.setItem('training_plans_ui', 'vanilla');
    window.location.reload();
  };

  const renderTemplateCard = (template) => {
    const weekData = parseWeekStructure(template.week_structure || []);
    const stats = getWeekStats(weekData);
    const tone = getTemplateTone(template, stats.focus);

    return (
      <div className={`tp-template-card ${tone}`} key={template.id}>
        <div className="tp-template-card__header">
          <div>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
          </div>
          <span className="tp-template-pill">{template.weeks} weeks</span>
        </div>
        <div className="tp-template-meta">
          <span>{template.plan_type}</span>
          {template.phase ? <span>{template.phase}</span> : null}
          <span>{stats.totalSessions} sessions/week</span>
        </div>
        <div className="tp-template-week">
          {dayLabels.map((label, index) => {
            const session = weekData[index];
            const category = getSessionCategory(session);
            return (
              <div className="tp-template-day" key={`${template.id}-${label}`}>
                <div className={`tp-day-pill tp-day-pill--${category}`} title={formatWeekSession(session)} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="tp-template-actions">
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => {
              setActiveTemplateId(template.id);
              setIsModalOpen(true);
            }}
            disabled={actionBusy}
          >
            View Details
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => handleCreatePlan(template.id)}
            disabled={actionBusy}
          >
            Start Plan
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="training-plans-react">
        <div
          dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 1 }) }}
        />
      </div>
    );
  }

  return (
    <div className="training-plans-react">
      <section className="tp-hero">
        <div className="tp-hero-left">
          <div className="tp-hero-eyebrow">Training Plans Studio</div>
          <h1 className="tp-hero-title">{CONFIG.PAGE_TITLE}</h1>
          <div className="tp-hero-underline" />
          <p className="tp-hero-copy">{CONFIG.PAGE_DESCRIPTION}</p>

          <div className="tp-hero-stats">
            <div className="tp-stat-card">
              <span className="tp-stat-label">Templates</span>
              <span className="tp-stat-value">{templates.length}</span>
            </div>
            <div className="tp-stat-card">
              <span className="tp-stat-label">Active plan</span>
              <span className="tp-stat-value">{activePlan ? 'Yes' : 'None'}</span>
            </div>
            <div className="tp-stat-card">
              <span className="tp-stat-label">Next start</span>
              <span className="tp-stat-value">{formatDateLabel(nextPlanStart)}</span>
            </div>
          </div>

          <div className="tp-hero-actions">
            <button
              className="btn btn--primary"
              onClick={() => templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Browse templates
            </button>
            <button className="btn btn--ghost" onClick={handleSwitchToClassic}>
              Use classic layout
            </button>
          </div>
        </div>

        <div className="tp-hero-right">
          <div className="tp-pulse-card">
            <div className="tp-pulse-header">
              <h3>Plan Pulse</h3>
              <span className={`tp-pulse-tag ${activePlan ? 'is-active' : ''}`}>
                {activePlan ? 'Active' : 'Idle'}
              </span>
            </div>
            <div className="tp-pulse-body">
              <div>
                <div className="tp-pulse-label">Current focus</div>
                <div className="tp-pulse-value">{activePlan?.phase || activePlan?.plan_type || 'No block set'}</div>
              </div>
              <div>
                <div className="tp-pulse-label">Selected start date</div>
                <div className="tp-pulse-value">{formatDateLabel(startDate)}</div>
              </div>
              <div>
                <div className="tp-pulse-label">Schedule status</div>
                <div className="tp-pulse-value">{activePlan ? 'On track' : 'Ready to plan'}</div>
              </div>
            </div>
            <div className="tp-pulse-footer">
              <span>Tip: pick a start date to auto-fill your calendar.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="tp-panel" ref={templatesRef}>
        <div className="tp-panel-header">
          <div>
            <h2>Plan Templates</h2>
            <p>Pick a start date and auto-schedule workouts into your calendar.</p>
          </div>
          <div className="tp-filter-group">
            {planTypes.map((type) => (
              <button
                key={type}
                className={`tp-filter ${activeFilter === type ? 'is-active' : ''}`}
                onClick={() => setActiveFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-controls">
          <div className="form-group">
            <label htmlFor="plan-start-date" className="form-label">Start Date</label>
            <input
              type="date"
              id="plan-start-date"
              className="form-input"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="plan-name" className="form-label">Plan Name (optional)</label>
            <input
              type="text"
              id="plan-name"
              className="form-input"
              placeholder="My Spring Block"
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
            />
          </div>
        </div>

        <div className="tp-template-grid">
          {filteredTemplates.length === 0 ? (
            <div className="training-plans-empty">No templates available.</div>
          ) : (
            filteredTemplates.map(renderTemplateCard)
          )}
        </div>
      </section>

      <section className="tp-panel">
        <div className="tp-panel-header">
          <div>
            <h2>Your Plans</h2>
            <p>Review existing plans, track progress, and manage your active block.</p>
          </div>
        </div>

        <div className="tp-plan-list">
          {plans.length === 0 ? (
            <div className="training-plans-empty">No plans created yet.</div>
          ) : (
            plans.map((plan) => {
              const progress = computePlanProgress(plan.start_date, plan.end_date);
              return (
                <div className={`tp-plan-row ${plan.is_active ? 'is-active' : ''}`} key={plan.id}>
                  <div>
                    <div className="tp-plan-title">{plan.name}</div>
                    <div className="tp-plan-meta">
                      {plan.plan_type || 'Plan'} · {formatDateLabel(plan.start_date)} → {formatDateLabel(plan.end_date)}
                    </div>
                    {progress !== null ? (
                      <div className="tp-plan-progress">
                        <div className="tp-plan-progress__fill" style={{ width: `${progress}%` }} />
                        <span>{progress}%</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="tp-plan-actions">
                    {plan.is_active ? (
                      <span className="tp-plan-status">Active</span>
                    ) : (
                      <button
                        className="btn btn--sm"
                        onClick={() => handleSetActivePlan(plan.id, plan.start_date)}
                        disabled={actionBusy}
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      className="btn btn--sm btn--secondary"
                      onClick={() => handleViewCalendar(plan.start_date)}
                      disabled={actionBusy}
                    >
                      View Calendar
                    </button>
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => handleRegeneratePlan(plan.id, plan.start_date)}
                      disabled={actionBusy}
                    >
                      Regenerate
                    </button>
                    <button
                      className="btn btn--sm btn--danger btn--ghost"
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={actionBusy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div
        className={`training-plan-modal ${isModalOpen && activeTemplate ? 'is-visible' : ''}`}
        id="training-plan-modal"
        onClick={(event) => {
          if (event.target?.id === 'training-plan-modal') {
            setIsModalOpen(false);
            setActiveTemplateId(null);
          }
        }}
      >
        <div className="training-plan-modal__dialog">
          <div className="training-plan-modal__header">
            <div>
              <h3>{activeTemplate?.name || 'Plan Details'}</h3>
              <p>{activeTemplate?.description || ''}</p>
            </div>
            <button
              className="btn btn--icon btn--sm"
              aria-label="Close"
              onClick={() => {
                setIsModalOpen(false);
                setActiveTemplateId(null);
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="training-plan-modal__body">
            <div className="training-plan-modal__meta">
              {activeTemplate?.plan_type ? <span>{activeTemplate.plan_type}</span> : null}
              {activeTemplate?.phase ? <span>{activeTemplate.phase}</span> : null}
              {activeTemplate?.weeks ? <span>{activeTemplate.weeks} weeks</span> : null}
            </div>
            <div className="training-plan-modal__preview">
              <h4>Week 1 Preview</h4>
              <div className="training-plan-week">
                {dayLabels.map((label, index) => {
                  const session = weekPreview[index];
                  return (
                    <div className="training-plan-week__row" key={label}>
                      <span className="training-plan-week__day">{label}</span>
                      <span className="training-plan-week__session">
                        {formatWeekSession(session)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="training-plan-modal__footer">
            <button
              className="btn btn--secondary"
              onClick={() => {
                setIsModalOpen(false);
                setActiveTemplateId(null);
              }}
            >
              Close
            </button>
            {activeTemplate ? (
              <button
                className="btn btn--primary"
                onClick={() => handleCreatePlan(activeTemplate.id)}
                disabled={actionBusy}
              >
                Start Plan
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
