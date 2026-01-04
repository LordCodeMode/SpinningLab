import React from 'react';
import { createRoot } from 'react-dom/client';
import WorkoutLibraryApp from '../../../../src/react/workout-library/WorkoutLibraryApp.jsx';

class WorkoutLibraryReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="workout-library-react-root"></div>';
    const mountNode = document.getElementById('workout-library-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(WorkoutLibraryApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new WorkoutLibraryReactPage();
export default page;
