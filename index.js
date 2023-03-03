const path = require('node:path');

const express = require('express');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(morgan('tiny'));

app.use(express.static('public'));

app.get('/postuler', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'routes/postuler.html'));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
