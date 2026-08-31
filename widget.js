const currentScript = document.currentScript;
const scriptUrl = new URL (currentScript.src);
const widgetId = scriptUrl.searchParams.get('id');

console.log('Widget ID from script tag: ', widgetId);