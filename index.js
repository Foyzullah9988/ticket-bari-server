const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  // console.log(req.headers.authorization);
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: 'unauthorize access' })
  }
  try {
    const idToken = token.split(' ')[1];
    // console.log(idToken);
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    // console.log(decoded);
    next()
  }
  catch (err) {
    return res.status(401).send({ message: 'unauthorize access' })
  }
}

app.get('/', (req, res) => {
  res.send('running the operation')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r5czbuf.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('ticket-bari_db')
    const usersCollection = db.collection('users');

    // user related api's
    app.get('/users', verifyFBToken, async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      user.role = 'user';
      user.createdAt = new Date();
      const email = user.email;
      const userExist = await usersCollection.findOne({ email });

      if (userExist) {
        return res.send({ message: 'user exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });
            res.send({ role: user?.role || 'user' })
        })










    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`App running in port : ${port}`);
})