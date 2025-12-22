const express = require('express');
const cors = require('cors');
require('dotenv').config()
const stripe = require("stripe")((process.env.STRIPE_SECRET_KEY));
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

// comment
// const serviceAccount = require("./ticketBari.json");
// comment
// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.use(cors({
  origin: ['https://ticket-bari-15f05.web.app', process.env.LOCAL_HOST],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  try {
    const idToken = token.split(' ')[1];

    const decoded = await admin.auth().verifyIdToken(idToken);

    req.decoded_email = decoded.email;

    next();
  } catch (err) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
};

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
    // await client.connect();

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
    const verifyVendor = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user?.role !== 'vendor') {
        return res.status(403).send({ message: 'forbidden access' })
      }

      next();
    }




    // payment related api
    app.post("/create-checkout-session", verifyFBToken, async (req, res) => {
      try {
        const paymentInfo = req.body;
        if (!paymentInfo.totalPrice || !paymentInfo.ticketId || !paymentInfo.userEmail) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: paymentInfo.ticketTitle,
                },
                unit_amount: Math.round(paymentInfo.totalPrice * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          metadata: {
            ticketId: paymentInfo.ticketId,
            userEmail: paymentInfo.userEmail,
          },

          success_url: `${process.env.CLIENT_HOST}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}&ticketId=${paymentInfo.ticketId}`,
          cancel_url: `${process.env.CLIENT_HOST}/dashboard/payment-cancelled?ticketId=${paymentInfo.ticketId}`,

          // Disable address collection
          billing_address_collection: 'auto',

          customer_creation: 'if_required',
        });
        res.json({ url: session.url });

      } catch (error) {
        res.status(500).json({
          error: error.message || "Payment failed",
          code: error.code
        });
      }
    });

    app.patch('/payment-success', verifyFBToken, async (req, res) => {
      try {
        const { session_id } = req.query;

        if (!session_id) {
          return res.status(400).json({ error: "Session ID is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        const bookingId = session.metadata?.ticketId;

        if (!bookingId) {
          return res.status(400).json({ error: "Booking ID not found" });
        }

        // Find booking
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(bookingId)
        });

        if (!booking) {
          return res.status(404).json({ error: "Booking not found" });
        }

        // Check if already paid
        if (booking.status === 'paid') {
          return res.status(200).json({
            success: true,
            message: "Already paid"
          });
        }

        // Update booking status
        await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          {
            $set: {
              status: 'paid',
              paymentStatus: 'completed',
              paymentDate: new Date(),
              stripeSessionId: session_id
            }
          }
        );

        // Update ticket quantity
        await ticketsCollection.updateOne(
          { _id: new ObjectId(booking.ticketId) },
          { $inc: { availableQuantity: -booking.quantity } }
        );

        res.status(200).json({
          success: true,
          message: "Payment successful"
        });

      } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({
          error: "Payment processing failed"
        });
      }
    });





    // booking related api's
    app.get('/bookings', verifyFBToken, async (req, res) => {
      const { vendorEmail, userEmail } = req.query;
      let query = {};
      if (vendorEmail) {
        query.vendorEmail = vendorEmail
      }
      if (userEmail) {
        query.userEmail = userEmail
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/bookings/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: 'Invalid booking ID' });
        }

        const result = await bookingsCollection.findOne({
          _id: new ObjectId(id)
        });

        if (!result) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/bookings', verifyFBToken, async (req, res) => {
      const booking = req.body;
      booking.createdAt = new Date();
      const result = await bookingsCollection.insertOne(booking);
      res.send({
        success: true,
        message: 'booking added',
        insertedId: result.insertedId
      })
    })

    app.get('/bookings/revenue/status', verifyFBToken, async (req, res) => {

      const pipeline = [
        {
          $match: {
            status: 'paid'
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' },
            totalTicketSold: { $sum: '$quantity' }
          }
        }
      ]
      const result = await bookingsCollection.aggregate(pipeline).toArray();
      res.send(result)
    })

    app.patch('/bookings/:id', verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const update = {
        $set: req.body
      }
      const result = await bookingsCollection.updateOne({ _id: new ObjectId(id) }, update);
      res.send(result)
    }
    )

    app.delete('/bookings/:id', verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result)
    })






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

    app.get('/tickets/:id', verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await ticketsCollection.findOne({ _id: new ObjectId(id) });

      res.send(result)
    })

    app.patch('/tickets/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { verificationStatus, isAdvertise, advertisement, ...otherFields } = req.body;

        const userEmail = req.decoded_email;
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        const ticket = await ticketsCollection.findOne({ _id: new ObjectId(id) });
        if (!ticket) {
          return res.status(404).send({ message: 'Ticket not found' });
        }

        const isAdmin = user.role === 'admin';
        const isTicketOwner = ticket.vendorEmail === userEmail;

        if (verificationStatus !== undefined && !isAdmin) {
          return res.status(403).send({
            message: 'Forbidden: Only admin can update verification status'
          });
        }

        if ((isAdvertise !== undefined || advertisement !== undefined) &&
          !isAdmin && !isTicketOwner) {
          return res.status(403).send({
            message: 'Forbidden: Only admin or ticket owner can update advertisement'
          });
        }

        const updateDoc = { $set: {} };

        if (verificationStatus !== undefined) {
          updateDoc.$set.verificationStatus = verificationStatus;
        }
        if (isAdvertise !== undefined) {
          updateDoc.$set.isAdvertise = isAdvertise;
        }
        if (advertisement !== undefined) {
          updateDoc.$set.advertisement = advertisement;
        }

        if (Object.keys(otherFields).length > 0) {
          if (!isAdmin && !isTicketOwner) {
            return res.status(403).send({
              message: 'Forbidden: Only admin or ticket owner can update other fields'
            });
          }
          Object.keys(otherFields).forEach(key => {
            updateDoc.$set[key] = otherFields[key];
          });
        }

        const result = await ticketsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.send(result);

      } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/tickets/:id', verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await ticketsCollection.deleteOne({ _id: new ObjectId(id) });

      res.send(result)
    })




    app.post('/tickets', verifyFBToken,verifyVendor, async (req, res) => {
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

    app.post('/users', verifyFBToken, async (req, res) => {
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

    app.patch('/users/:id', verifyFBToken, verifyAdmin, async (req, res) => {
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

    app.get('/users/:email/role', async (req, res) => {
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
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`App running in port : ${port}`);
})