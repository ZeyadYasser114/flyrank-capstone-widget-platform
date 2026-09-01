const currentScript = document.currentScript;
const scriptUrl = new URL(currentScript.src);
const widgetId = scriptUrl.searchParams.get('id');
app.post('/widgets', requireAuth, async (req, res) => {});

fetch(`http://localhost:3000/widgets/${widgetId}/config`)
    .then(response => response.json())
    .then(config => {
        const container = document.createElement('div');

        const title = document.createElement('h2');
        title.textContent = config.title;
        container.appendChild(title);
        const inputs = [];

        config.fields.forEach(fieldName => {
            const input = document.createElement('input');
            input.setAttribute('placeholder', fieldName);
            input.setAttribute('name', fieldName);
            container.appendChild(input);
            inputs.push(input);
        });


        const button = document.createElement('button');
        button.textContent = config.button_text;
        container.appendChild(button);

    button.addEventListener('click', () => {
        const data = {};
        inputs.forEach(input => {
            data[input.name] = input.value;
        });

        fetch('http://localhost:3000/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: widgetId, data: data })
        })
            .then(response => response.json())
            .then(result => {
                console.log('Submission result:', result);
            });
    });

        document.body.appendChild(container);
    });