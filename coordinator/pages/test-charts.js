// /static/js/coordinator/pages/test-charts.js
// Test page to verify chart libraries are working

export const testChartsPage = {
    async load() {
      console.log('[TestCharts] Loading test charts page...');
      
      const content = document.getElementById('page-content');
      if (!content) {
        console.error('[TestCharts] page-content element not found');
        return;
      }
  
      // Clear existing content
      content.innerHTML = `
        <div class="content-wrapper">
          <h2>Chart Library Test</h2>
          
          <div class="charts-container">
            <div class="chart-card">
              <h3>Chart.js Test</h3>
              <canvas id="test-chartjs" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-card">
              <h3>Plotly Test</h3>
              <div id="test-plotly" style="width:100%; height:300px;"></div>
            </div>
            
            <div class="chart-card">
              <h3>Debug Info</h3>
              <div id="debug-info"></div>
            </div>
          </div>
        </div>
      `;
  
      // Test Chart.js availability
      this.testChartJS();
      
      // Test Plotly availability
      this.testPlotly();
      
      // Show debug info
      this.showDebugInfo();
    },
  
    testChartJS() {
      console.log('[TestCharts] Testing Chart.js...');
      console.log('Chart.js available:', !!window.Chart);
      
      if (!window.Chart) {
        document.getElementById('test-chartjs').innerHTML = 'Chart.js not loaded';
        return;
      }
  
      try {
        const ctx = document.getElementById('test-chartjs').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
              label: 'Test Data',
              data: [10, 20, 15, 25, 30],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Chart.js Working!'
              }
            }
          }
        });
        console.log('[TestCharts] Chart.js test successful');
      } catch (error) {
        console.error('[TestCharts] Chart.js error:', error);
        document.getElementById('test-chartjs').innerHTML = `Chart.js error: ${error.message}`;
      }
    },
  
    testPlotly() {
      console.log('[TestCharts] Testing Plotly...');
      console.log('Plotly available:', !!window.Plotly);
      
      if (!window.Plotly) {
        document.getElementById('test-plotly').innerHTML = 'Plotly not loaded';
        return;
      }
  
      try {
        const data = [{
          x: ['A', 'B', 'C', 'D', 'E'],
          y: [20, 14, 23, 25, 22],
          type: 'scatter',
          mode: 'lines+markers',
          marker: { color: '#10b981' },
          name: 'Test Data'
        }];
  
        const layout = {
          title: 'Plotly Working!',
          xaxis: { title: 'Categories' },
          yaxis: { title: 'Values' },
          margin: { t: 50, r: 30, b: 40, l: 40 }
        };
  
        Plotly.newPlot('test-plotly', data, layout, {responsive: true});
        console.log('[TestCharts] Plotly test successful');
      } catch (error) {
        console.error('[TestCharts] Plotly error:', error);
        document.getElementById('test-plotly').innerHTML = `Plotly error: ${error.message}`;
      }
    },
  
    showDebugInfo() {
      const debugInfo = document.getElementById('debug-info');
      const info = {
        'Chart.js Version': window.Chart?.version || 'Not loaded',
        'Plotly Version': window.Plotly?.version || 'Not loaded',
        'Page Content Element': !!document.getElementById('page-content'),
        'Current Page': window.location.hash || 'none',
        'Console Errors': 'Check browser console for errors'
      };
  
      debugInfo.innerHTML = `
        <ul style="list-style: none; padding: 0;">
          ${Object.entries(info).map(([key, value]) => 
            `<li><strong>${key}:</strong> ${value}</li>`
          ).join('')}
        </ul>
      `;
    },
  
    async refresh() {
      console.log('[TestCharts] Refreshing...');
      await this.load();
    }
  };