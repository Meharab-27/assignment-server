


const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin"); 
require("dotenv").config()

const app = express()
const port = 3000;

// ✅ service key যুক্ত করো (তোমার serviceKey.json ফাইলের path)
const serviceAccount = require("./serviceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
  
console.log(process.env.DB_PASSWORD)
app.use(cors())
app.use(express.json())

// ✅ Firebase Token Verify Middleware
const verifyFireBaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    console.log('✅ Token verified:', userInfo.email);
    next();
  } catch (error) {
    console.log(' Invalid token');
    return res.status(401).send({ message: 'unauthorized access' });
  }
};



// ---------------------------
// 🔗 MongoDB Connection
// ---------------------------
const uri = 
`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.tsxk2kx.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // await client.connect();

    const db = client.db('book-db');
    const bookCollection = db.collection('books');
    const commentCollection = db.collection('comments');

    // ✅ Get all books
    app.get('/books', async (req, res) => {
      const result = await bookCollection.find().toArray();
      res.send(result);
    });

    // ✅ Get single book
    app.get('/books/:id', async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await bookCollection.findOne({ _id: objectId });
      res.send({ success: true, result });
    });

   
    // POST /books route with token verification
app.post('/books', verifyFireBaseToken, async (req, res) => {
  const data = req.body;

  // Ensure the user sending request matches token email
  if (data.userEmail !== req.token_email) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  try {
    const result = await bookCollection.insertOne(data);
    res.send({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: 'Server error' });
  }
});

    // ✅ Protected route — Verify token before fetching user books
    app.get("/my-books", verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;
      console.log("🟦 Request by:", req.token_email, "for:", email);

      if (email !== req.token_email) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const result = await bookCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // ✅ Delete book
    app.delete('/books/:id',verifyFireBaseToken,async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const result = await bookCollection.deleteOne(filter);
      res.send({ success: true, result });
    });

    // ✅ Update book
    app.put("/books/:id", verifyFireBaseToken,async (req, res) => {
      try {
        // const id = req.params.id;
        const updatedBook = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            title: updatedBook.title,
            author: updatedBook.author,
            genre: updatedBook.genre,
            rating: updatedBook.rating,
            summary: updatedBook.summary,
            coverImage: updatedBook.coverImage
          },
        };

        const result = await bookCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Book updated successfully" });
        } else {
          res.send({ success: false, message: "No changes made" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // ✅ Latest 6 books
    app.get('/latest-books', async (req, res) => {
      const result = await bookCollection.find().sort({ created_at: 'desc' }).limit(6).toArray();
      res.send(result);
    });

    // ✅ Sort books by rating
    app.get('/books/sort/:order', async (req, res) => {
      const order = req.params.order;
      const sortOrder = order === 'desc' ? -1 : 1;

      const result = await bookCollection
        .aggregate([{ $sort: { rating: sortOrder } }])
        .toArray();

      res.send(result);
    });

    // ✅ Add comment
    app.post('/comments', async (req, res) => {
      const comment = req.body;
      comment.createdAt = new Date();
      const result = await commentCollection.insertOne(comment);
      res.send(result);
    });

    // ✅ Get comments for a specific book
    app.get('/comments/:bookId', async (req, res) => {
      const bookId = req.params.bookId;
      const result = await commentCollection
        .find({ bookId: bookId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB!");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running again');
});

app.listen(port, () => {
  console.log(`🚀 Server is listening on port ${port}`);
});
