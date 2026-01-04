import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from '../../../../src/react/settings/SettingsApp.jsx';

class SettingsReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="settings-react-root"></div>';
    const mountNode = document.getElementById('settings-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(SettingsApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new SettingsReactPage();
export default page;
