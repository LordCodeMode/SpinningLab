import React from 'react';
import { createRoot } from 'react-dom/client';
import EfficiencyApp from '../../../../src/react/efficiency/EfficiencyApp.jsx';

class EfficiencyReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="efficiency-react-root"></div>';
    const mountNode = document.getElementById('efficiency-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(EfficiencyApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new EfficiencyReactPage();
export default page;
