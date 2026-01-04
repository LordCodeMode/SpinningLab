import React from 'react';
import { createRoot } from 'react-dom/client';
import CalendarApp from '../../../../src/react/calendar/CalendarApp.jsx';

class CalendarReactPage {
  constructor() {
    this.root = null;
  }

  async load() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = '<div id="calendar-react-root"></div>';
    const mountNode = document.getElementById('calendar-react-root');
    if (!mountNode) return;

    this.root = createRoot(mountNode);
    this.root.render(React.createElement(CalendarApp));
  }

  async onUnload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const page = new CalendarReactPage();
export default page;
