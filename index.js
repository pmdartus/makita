const path = require('node:path');

const express = require('express');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(morgan('tiny'));
app.use(express.static('public'));

const routes = ['postuler', 'postuler-vite', 'postuler-plus-vite'];

for (const route of routes) {
    app.get(`/${route}`, (req, res) => {
        res.sendFile(path.resolve(__dirname, `routes/${route}.html`));
    });
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
