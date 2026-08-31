const currentScript = document.currentScript;
const scriptUrl = new URL(currentScript.src);
const widgetId = scriptUrl.searchParams.get('id');

fetch(`http://localhost:3000/widgets/${widgetId}/config`)
    .then(response => response.json())
    .then(config => {
        const container = document.createElement('div');

        const title = document.createElement('h2');
        title.textContent = config.title;
        container.appendChild(title);

        document.body.appendChild(container);
    });