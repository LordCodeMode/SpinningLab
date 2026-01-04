import React from 'react';
import { createRoot } from 'react-dom/client';
import TrainingPlansApp from '../../../../src/react/training-plans/TrainingPlansApp.jsx';

class TrainingPlansReactPage {
  constructor() {
    this.root = null;
    this.delegate = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="training-plans-react-root"></div>';
    const mountNode = document.getElementById('training-plans-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(TrainingPlansApp));
  }

  async onUnload() {
    if (this.delegate?.onUnload) {
      await this.delegate.onUnload();
      this.delegate = null;
    }
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new TrainingPlansReactPage();
export default page;
