import React from 'react';
import { Save } from 'lucide-react';
import { parseTagsInput } from '../activityUtils';

const ActivityAnnotations = ({ 
  tagsInput, 
  setTagsInput, 
  rpeInput, 
  setRpeInput, 
  notesInput, 
  setNotesInput, 
  onSave 
}) => {
  return (
    <div className="activity-annotations-panel">
      <div className="activity-annotations-header section-header">
        <h2 className="activity-section-title section-title">Notes & Tags</h2>
        <p className="activity-annotations-subtitle section-subtitle">Capture context, effort, and recovery notes.</p>
      </div>
      <div className="activity-annotation-field">
        <label htmlFor="activity-tags-input">Tags</label>
        <input
          type="text"
          id="activity-tags-input"
          className="activity-annotation-input"
          placeholder="#interval, #race"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
        />
        <div className="activity-tag-preview">
          {parseTagsInput(tagsInput).length ? (
            parseTagsInput(tagsInput).map((tag) => (
              <span key={tag} className="activity-tag-pill">#{tag}</span>
            ))
          ) : (
            <span className="activity-tag-preview__empty">No tags yet</span>
          )}
        </div>
      </div>
      <div className="activity-annotation-field">
        <label htmlFor="activity-rpe-input">RPE (1-10)</label>
        <input
          type="number"
          id="activity-rpe-input"
          className="activity-annotation-input"
          min="1"
          max="10"
          step="1"
          value={rpeInput}
          onChange={(event) => setRpeInput(event.target.value)}
        />
      </div>
      <div className="activity-annotation-field">
        <label htmlFor="activity-notes-input">Notes</label>
        <textarea
          id="activity-notes-input"
          className="activity-annotation-textarea"
          rows="4"
          placeholder="How did this session feel? Any context to remember?"
          value={notesInput}
          onChange={(event) => setNotesInput(event.target.value)}
        />
      </div>
      <button className="btn btn--primary" onClick={onSave}>
        <Save size={16} className="mr-2" />
        Save Notes
      </button>
    </div>
  );
};

export default ActivityAnnotations;
