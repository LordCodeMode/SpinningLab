import React from 'react';
import { createRoot } from 'react-dom/client';
import ZonesApp from '../../../../src/react/zones/ZonesApp.jsx';

class ZonesReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="zones-react-root"></div>';
    const mountNode = document.getElementById('zones-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(ZonesApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new ZonesReactPage();
export default page;
