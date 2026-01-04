import React from 'react';
import { createRoot } from 'react-dom/client';
import ActivitiesApp from '../../../../src/react/activities/ActivitiesApp.jsx';

class ActivitiesReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="activities-react-root"></div>';
    const mountNode = document.getElementById('activities-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(ActivitiesApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new ActivitiesReactPage();
export default page;
