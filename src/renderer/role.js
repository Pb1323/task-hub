// Runs before first paint: which of the three windows this is (tab | side | big) decides which part of the page shows.
document.documentElement.dataset.role = new URLSearchParams(location.search).get('role') || 'side';
