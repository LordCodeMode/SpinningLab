import React from 'react';
import { createRoot } from 'react-dom/client';
import ActivityDetailApp from '../../../../src/react/activity/ActivityDetailApp.jsx';

class ActivityDetailReactPage {
  constructor() {
    this.root = null;
  }

  async load(params) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="activity-detail-react-root"></div>';
    const mountNode = document.getElementById('activity-detail-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(ActivityDetailApp, { activityId: params?.id || null }));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new ActivityDetailReactPage();
export default page;
