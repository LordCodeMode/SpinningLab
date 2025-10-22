// ============================================
// FILE: pages/settings/config.js
// Settings Page Configuration
// ============================================

export default {
  id: 'settings',
  title: 'Settings',
  subtitle: 'Configure your profile and training parameters',
  icon: 'settings',
  description: 'Manage FTP, body weight, heart rate zones, and training load parameters',
  
  dataRequirements: { 
    settings: true 
  },
  
  // Don't cache settings - always fetch fresh
  cache: { 
    enabled: false 
  }
};