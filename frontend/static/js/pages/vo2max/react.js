import React from 'react';
import { createRoot } from 'react-dom/client';
import Vo2maxApp from '../../../../src/react/vo2max/Vo2maxApp.jsx';

class Vo2maxReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="vo2max-react-root"></div>';
    const mountNode = document.getElementById('vo2max-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(Vo2maxApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new Vo2maxReactPage();
export default page;
