const express = require('express');
const cors = require('cors');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('running the operation')
})

app.listen(port, () => {
    console.log(`App running in port : ${port}`);
})