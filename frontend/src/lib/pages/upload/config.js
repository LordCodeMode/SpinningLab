// ============================================
// FILE: pages/upload/config.js
// Upload Page Configuration
// ============================================

export default {
  id: 'upload',
  title: 'Upload Activities',
  subtitle: 'Import .FIT files from your devices',
  icon: 'upload',
  description: 'Drag and drop or browse to upload activity files',
  
  // No data requirements for upload page
  dataRequirements: {},
  
  // Don't cache upload page
  cache: { 
    enabled: false 
  },
  
  // Upload settings
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 50,
    supportedFormats: ['.fit'],
    acceptedMimeTypes: ['application/octet-stream']
  }
};