import React from 'react';
import { createRoot } from 'react-dom/client';
import CriticalPowerApp from '../../../../src/react/critical-power/CriticalPowerApp.jsx';

class CriticalPowerReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="critical-power-react-root"></div>';
    const mountNode = document.getElementById('critical-power-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(CriticalPowerApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new CriticalPowerReactPage();
export default page;
