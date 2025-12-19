const express = require('express');
const cors = require('cors');
require('dotenv').config()
const stripe = require("stripe")((process.env.STRIPE_SECRET_KEY), {
  apiVersion: "2025-12-15.clover",
});
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

const serviceAccount = require("./ticketBari.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.use(cors({
  origin: [(process.env.CLIENT_HOST), (process.env.LOCAL_HOST)],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
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
    const ticketsCollection = db.collection('tickets');
    const bookingsCollection = db.collection('bookings');

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }

      next();
    }

    // payment related api
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;

      const session = await stripe.checkout.sessions.create({
        ui_mode: "custom",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: paymentInfo.price * 100,
              product_data: {
                name: paymentInfo.title,
              },
            },

            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          ticketId: paymentInfo.ticketId,

        },
        customer_email: paymentInfo.email,
        success_url: `${process.env.CLIENT_HOST}/dashboard/payment-success`,
        cancel_url: `${process.env.CLIENT_HOST}/dashboard/payment-cancelled`,
      });
      console.log(session);
      res.send({ url: session.url });
    });






    // booking related api's
    app.get('/bookings', async (req, res) => {
      const {vendorEmail , userEmail} = req.query;
      let query = {};
      if(vendorEmail){
        query.vendorEmail = vendorEmail
      }
      if(userEmail){
        query.userEmail = userEmail
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      booking.createdAt = new Date();
      const result = await bookingsCollection.insertOne(booking);
      res.send({
        success: true,
        message: 'booking added',
        insertedId: result.insertedId
      })
    })

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const update = {
        $set: req.body
      }
      const result = await bookingsCollection.updateOne({ _id: new ObjectId(id) }, update);
      res.send(result)
    }
    )


    



    // tickets related api's
    app.get('/tickets', async (req, res) => {
      const { vendorEmail } = req.query;
      let query = {};
      if (vendorEmail) {
        query.vendorEmail = vendorEmail
      }
      const result = await ticketsCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/tickets/:id', async (req, res) => {
      const id = req.params.id;

      const result = await ticketsCollection.findOne({ _id: new ObjectId(id) });

      res.send(result)
    })

    app.patch('/tickets/:id', async (req, res) => {
      const id = req.params.id;
      const update = {
        $set: req.body
      }
      const result = await ticketsCollection.updateOne({ _id: new ObjectId(id) }, update);

      res.send(result)
    })

    app.delete('/tickets/:id', async (req, res) => {
      const id = req.params.id;

      const result = await ticketsCollection.deleteOne({ _id: new ObjectId(id) });

      res.send(result)
    })

    app.patch('/tickets/:id', async (req, res) => {
      const id = req.params.id;
      const { verificationStatus, isAdvertise, advertisement } = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {

        }
      }

      if (verificationStatus !== undefined) {
        updateDoc.$set.verificationStatus = verificationStatus;
      }
      if (isAdvertise !== undefined) {
        updateDoc.$set.isAdvertise = isAdvertise;
      }
      if (advertisement !== undefined) {
        updateDoc.$set.advertisement = advertisement;
      }

      const result = await ticketsCollection.updateOne(query, updateDoc);
      res.send(result)
    })


    app.post('/tickets', async (req, res) => {
      const ticketData = req.body;
      ticketData.createdAt = new Date();
      ticketData.verificationStatus = 'pending';
      ticketData.availableQuantity = ticketData.quantity;

      const result = await ticketsCollection.insertOne(ticketData)
      res.send({
        success: true,
        message: 'ticket added',
        insertedId: result.insertedId
      })
    })


    // user related api's
    app.get('/users', async (req, res) => {
      const email = req.query.email;

      if (email) {
        try {
          const user = await usersCollection.findOne({ email });

          if (!user) {
            return res.status(404).send({ error: 'User not found' });
          }

          return res.send(user);
        } catch (error) {
          console.error('Error fetching user:', error);
          return res.status(500).send({ error: 'Internal server error' });
        }
      }

      try {
        const cursor = usersCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ error: 'Internal server error' });
      }
    });

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

    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const update = {
        $set: {
          role: role,
        }
      }
      const result = await usersCollection.updateOne({ _id: new ObjectId(id) }, update);
      res.send(result)
    })

    app.get('/users/:email/role', verifyFBToken, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || 'user' })
    })

    // app.patch('/users/:id/role', verifyFBToken, async (req, res) => {
    //   const id = req.params.id;
    //   const roleInfo = req.body;
    //   const query = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       role: roleInfo.role
    //     }
    //   }
    //   const result = await usersCollection.updateOne(query, updateDoc);
    //   res.send(result)
    // })










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