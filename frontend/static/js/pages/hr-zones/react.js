import React from 'react';
import { createRoot } from 'react-dom/client';
import HrZonesApp from '../../../../src/react/hr-zones/HrZonesApp.jsx';

class HrZonesReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="hr-zones-react-root"></div>';
    const mountNode = document.getElementById('hr-zones-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(HrZonesApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new HrZonesReactPage();
export default page;
