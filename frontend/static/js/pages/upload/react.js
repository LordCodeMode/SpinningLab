import React from 'react';
import { createRoot } from 'react-dom/client';
import UploadApp from '../../../../src/react/upload/UploadApp.jsx';

class UploadReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="upload-react-root"></div>';
    const mountNode = document.getElementById('upload-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(UploadApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new UploadReactPage();
export default page;
