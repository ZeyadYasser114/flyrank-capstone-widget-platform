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

        config.fields.forEach(fieldName => {
            const input = document.createElement('input');
            input.setAttribute('placeholder', fieldName);
            input.setAttribute('name', fieldName);
            container.appendChild(input);
        });

        const button = document.createElement('button');
        button.textContent = config.button_text;
        container.appendChild(button);

        document.body.appendChild(container);
    });