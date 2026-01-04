import React from 'react';
import { createRoot } from 'react-dom/client';
import ComparisonsApp from '../../../../src/react/comparisons/ComparisonsApp.jsx';

class ComparisonsReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="comparisons-react-root"></div>';
    const mountNode = document.getElementById('comparisons-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(ComparisonsApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new ComparisonsReactPage();
export default page;
