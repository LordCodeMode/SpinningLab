export const getPageContainer = () => (
  document.getElementById('react-page-content') ||
  document.getElementById('pageContent') ||
  document.getElementById('page-content') ||
  document.getElementById('main-content')
);
