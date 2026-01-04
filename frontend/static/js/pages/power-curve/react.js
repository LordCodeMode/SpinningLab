import React from 'react';
import { createRoot } from 'react-dom/client';
import PowerCurveApp from '../../../../src/react/power-curve/PowerCurveApp.jsx';

class PowerCurveReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="power-curve-react-root"></div>';
    const mountNode = document.getElementById('power-curve-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(PowerCurveApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new PowerCurveReactPage();
export default page;
