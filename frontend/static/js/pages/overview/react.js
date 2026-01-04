import React from 'react';
import { createRoot } from 'react-dom/client';
import OverviewApp from '../../../../src/react/overview/OverviewApp.jsx';

class OverviewReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="overview-react-root"></div>';
    const mountNode = document.getElementById('overview-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(OverviewApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new OverviewReactPage();
export default page;
