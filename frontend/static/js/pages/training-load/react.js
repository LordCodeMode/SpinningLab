import React from 'react';
import { createRoot } from 'react-dom/client';
import TrainingLoadApp from '../../../../src/react/training-load/TrainingLoadApp.jsx';

class TrainingLoadReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="training-load-react-root"></div>';
    const mountNode = document.getElementById('training-load-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(TrainingLoadApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new TrainingLoadReactPage();
export default page;
