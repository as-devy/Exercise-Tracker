const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const bodyParser = require("body-parser")
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

app.use(cors())
app.use(express.static('public'))

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get("/api/users", async (req, res) => {
  const query = `SELECT * FROM users`;

  try {
    const dbres = await client.query(query);
    res.json(dbres.rows)
  } catch (err) {
    console.error('Error reading records', err.stack);
  }
})

app.post("/api/users", async (req, res) => {
  const user = req.body;

  const text = 'INSERT INTO users(username, _id) VALUES($1, $2) RETURNING *';
  const id = uuidv4().replace(/-/g, '').slice(0, 24)
  const values = [user.username, id];

  try {
    const dbres = await client.query(text, values);
    const { username, _id } = dbres.rows[0]
    res.json({
      username,
      _id
    })
  } catch (err) {
    console.error('Error inserting record', err.stack);
  }
})

app.post("/api/users/:_id/exercises", async (req, res) => {
  const { description, duration, date } = req.body;
  const authorId = req.params._id;

  try {
    const text = `INSERT INTO exercises (author_id, description, duration, date) 
                  VALUES ($1, $2, $3, $4) RETURNING *`;
    const values = [authorId, description, duration, date || new Date()];
    const exerciseDBRes = await client.query(text, values);
    const dbExercise = exerciseDBRes.rows[0];

    const query = 'SELECT * FROM users WHERE _id = $1';
    const userDBRes = await client.query(query, [authorId]);
    const user = userDBRes.rows[0];

    res.json({
      _id: user._id,
      username: user.username,
      date: new Date(dbExercise.date).toDateString(),
      duration: Number(dbExercise.duration),
      description: dbExercise.description,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error retrieving user or inserting exercise' });
  }
});



app.get("/api/users/:_id/logs", async (req, res) => {
  const authorId = req.params._id;
  const { from, to, limit } = req.query;

  let exercisesQuery = `SELECT * FROM exercises WHERE author_id='${authorId}'`;

  if (from) {
    exercisesQuery += ` AND date >= '${from}'`;
  }

  if (to) {
    exercisesQuery += ` AND date <= '${to}'`;
  }

  if (limit) {
    exercisesQuery += ` LIMIT ${Number(limit)}`;
  }

  let exercises = [];

  try {
    const dbres = await client.query(exercisesQuery);

    exercises = dbres.rows.map((exercise) => ({
      description: exercise.description,
      duration: Number(exercise.duration),
      date: new Date(exercise.date).toDateString(),
    }));
  } catch (err) {
    console.error('Error reading records', err.stack);
    return res.status(500).json({ error: 'Error retrieving exercises' });
  }

  const userQuery = `SELECT * FROM users WHERE _id = $1`;

  try {
    const dbres = await client.query(userQuery, [authorId]);
    const user = dbres.rows[0];

    res.json({
      username: user.username,
      count: exercises.length,
      _id: authorId,
      log: exercises,
    });
  } catch (err) {
    console.error('Error reading records', err.stack);
    res.status(500).json({ error: 'Error retrieving user' });
  }
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
