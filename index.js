const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
// const jwt = require('jsonwebtoken');
require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvn4ffv.mongodb.net/?retryWrites=true&w=majority`;

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

    const contestCollections = client.db("contestHubDB").collection("users");

    // for home page popular item
    app.get('/popular', async(req, res) => {
      const filter = req.query;
      // console.log(filter);
      const query = {
        type: {$regex: filter.search, $options: 'i'}
      }
      const  options = {
        sort: {
          attemptedCount: filter.sort === 'asc' ? 1 : -1
        }
      }
        const cursor = contestCollections.find(query, options);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get("/contest", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      let queryObj = {}
      let sortObj = {};
     //  const category = req.query.category;
      const email = req.query.email;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      if(email){
       queryObj.email = email
      }
      if(sortField && sortOrder){
        sortObj[sortField] = sortOrder;
      }
      const result = await contestCollections
        .find(queryObj).sort(sortObj)
        .skip(page * size)
        .limit(size)
        .toArray();
     res.send(result);
   });

    app.get('/contest/:type', async(req, res) => {
        const type = req.params.type;
        const lowerType = new RegExp(type, "i");
        let data = {
          $or: [
            {
              type: lowerType,
            },
          ],
        };
        const cursor = contestCollections.find(data);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/contest/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        console.log(query);
        const result = await contestCollections.findOne(query);
        res.send(result);
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


app.get('/', (req, res) => {
  res.send('Contest Hub!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})