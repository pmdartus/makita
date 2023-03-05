const path = require('node:path');

const express = require('express');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(morgan('tiny'));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, `routes/index.html`));
})

const routes = [
    'postuler',
    'postuler-vite',
    'postuler-plus-vite',
    'postuler-toujours-plus-vite',
    'postuler-toujours-toujours-plus-vite',
];

for (const route of routes) {
    app.get(`/${route}`, (req, res) => {
        res.sendFile(path.resolve(__dirname, `routes/${route}.html`));
    });
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
