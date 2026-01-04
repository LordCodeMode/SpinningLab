import React from 'react';
import { createRoot } from 'react-dom/client';
import BestPowersApp from '../../../../src/react/best-powers/BestPowersApp.jsx';

class BestPowersReactPage {
  constructor() {
    this.root = null;
    this.delegate = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="best-powers-react-root"></div>';
    const mountNode = document.getElementById('best-powers-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(BestPowersApp));
  }

  async onUnload() {
    if (this.delegate?.onUnload) {
      await this.delegate.onUnload();
      this.delegate = null;
    }
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new BestPowersReactPage();
export default page;
