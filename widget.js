const currentScript = document.currentScript;
const scriptUrl = new URL(currentScript.src);
const widgetId = scriptUrl.searchParams.get('id');

fetch(`http://localhost:3000/widgets/${widgetId}/config`)
    .then(response => response.json())
    .then(config => {
        console.log('Widget config:', config);
    });