import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkoutBuilderApp from '../../../../src/react/workout-builder/WorkoutBuilderApp.jsx';

class WorkoutBuilderReactPage {
  constructor() {
    this.root = null;
    this.delegate = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="workout-builder-react-root"></div>';
    const mountNode = document.getElementById('workout-builder-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(WorkoutBuilderApp));
  }

  async onUnload() {
    if (this.delegate?.onUnload) {
      await this.delegate.onUnload();
      this.delegate = null;
    } else if (this.delegate?.unload) {
      this.delegate.unload();
      this.delegate = null;
    }
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new WorkoutBuilderReactPage();
export default page;
