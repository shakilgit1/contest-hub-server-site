const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvn4ffv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const contestCollections = client.db("contestHubDB").collection("contest");
    const userCollections = client.db("contestHubDB").collection("users");
    const paymentCollection = client.db("contestHubDB").collection("payments");
   

    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // verify admin after verify token
     const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollections.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
     }
    // verify creator after verify token
     const verifyCreator = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollections.findOne(query);
      const isCreator = user?.role === 'creator';
      if(!isCreator){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
     }

    // for home page popular item

    app.get("/popular", async (req, res) => {
      const filter = req.query;
      const type = req.query.type;
      // console.log(filter);
      let query = {};

      if(filter.search){
        query = {
              contestName: { $regex: filter.search, $options: "i" },
            };
      }
     
      const options = {
        sort: {
          attemptedCount: filter.sort === "asc" ? 1 : -1,
        },
      };
      const cursor = contestCollections.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/contest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(query);
      const result = await contestCollections.findOne(query);
      res.send(result);
    });

    // all contest 

    app.get("/contest", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      let queryObj = {};
      let sortObj = {};

       const type = req.query.type;
      // const email = req.query.email;
      // const sortField = req.query.sortField;
      // const sortOrder = req.query.sortOrder;
      if (type) {
        queryObj = {type: type}
      }
      // if (sortField && sortOrder) {
      //   sortObj[sortField] = sortOrder;
      // }
      const result = await contestCollections
        .find(queryObj)
        .sort(sortObj)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/contestCount", async (req, res) => {
      const count = await contestCollections.estimatedDocumentCount();
      res.send({ count });
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      // checking user
      const query = { email: user?.email };
      const existingUser = await userCollections.findOne(query);
      // console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollections.insertOne(user);
      res.send(result);
    });

    // user related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });
    // make admin
    app.patch('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollections.updateOne(filter, updatedDoc);
      res.send(result);
    })
    // make contest creator 
    app.patch('/user/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'creator'
        }
      }
      const result = await userCollections.updateOne(filter, updatedDoc);
      res.send(result);
    })
    // check admin 
    app.get('/users/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }

      const query = {email: email};
      const user = await userCollections.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })
    // check contest creator
    app.get('/users/creator/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }

      const query = {email: email};
      const user = await userCollections.findOne(query);
      let creator = false;
      if(user){
        creator = user?.role === 'creator';
      }
      res.send({creator});
    })

    // 
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollections.deleteOne(query);
      res.send(result);
    })

    // creator add item
    app.post('/contest', verifyToken, verifyCreator, async(req, res) => {
      const item = req.body;
      const result = await contestCollections.insertOne(item);
      res.send(result);
    })
    app.delete('/contest/:id',verifyToken, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await contestCollections.deleteOne(query);
      res.send(result);
    })
    app.get('/contest', async(req, res) => {
      const email = req.query.email;
      const query = {email: email};
      const result = await contestCollections.find(query).toArray();
      res.send(result);
    })

    app.patch('/contest/:id', async(req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          contestName: item.contestName,
          type: item.type,
          contestPrize: item.contestPrize,
          price: item.price,
          shortDescription: item.shortDescription,
          deadline: item.deadline,
          task: item.task,
          attemptedCount: item.attemptedCount,
          status: item.status,
          image: item.image
        }
      }
      const result = await contestCollections.updateOne(filter, updatedDoc);
      res.send(result);
   })

    app.patch('/confirm/:id', async(req, res) => {
      // const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {

         status: 'accepted',

        }
      }
      const result = await contestCollections.updateOne(filter, updatedDoc);
      res.send(result);
   })

    // payment 
    app.post('/create-payment-intent', async(req, res) => {
      const {price} = req.body;
      const amount = parseInt(price * 100);
    
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/payments', async(req, res) => {
      const query = {email: req.query.email};
      // if(req.params.email !== req.decoded.email){
      //   return res.status(403).send({message: 'forbidden access'});
      // }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/payments/:email', async(req, res) => {
      const query = {userEmail: req.params.email};
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    // app.get('/payments', async(req, res) => {
    //   const allData = req.body;
    //   const result = await paymentCollection.find().toArray();
    //   res.send(result);
    // })

    app.post('/payments', async(req, res) => {
       const payment = req.body;
       const paymentResult = await paymentCollection.insertOne(payment);
       
      res.send(paymentResult);

    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Contest Hub!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
