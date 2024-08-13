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
  const exercise = req.body;
  const authorId = req.params._id;

  const text = 'INSERT INTO exercises(author_id, description, duration) VALUES($1, $2, $3) RETURNING *';
  const values = [authorId, exercise.description, exercise.duration];

  let dbExercise;
  
  try {
    const dbres = await client.query(text, values);
    dbExercise = dbres.rows[0]
  } catch (err) {
    console.error('Error inserting record', err.stack);
  }

  const query = `SELECT * FROM users where _id='${authorId}'`;

  try {
    const dbres = await client.query(query);
    const user = dbres.rows[0];

    console.log(user)

    const date  = new Date(dbExercise.date);

    res.json({
      username: user.username,
      description: dbExercise.description,
      duration: dbExercise.duration,
      date: date.toDateString(),
      _id: authorId
    })
  } catch (err) {
    console.error('Error reading records', err.stack);
  }
})

app.get("/api/users/:_id/logs", async (req, res)=>{
  const authorId = req.params._id;
  const {from, to, limit} = req.query;

  let exercisesQuery;

  exercisesQuery = `SELECT * FROM exercises where author_id='${authorId}'`

  if (from && to){
    exercisesQuery = `SELECT * FROM exercises where author_id='${authorId}' AND created_at BETWEEN ${from} AND ${to}`
  }

  if (limit){
    exercisesQuery = `SELECT * FROM exercises where author_id='${authorId}' LIMIT ${limit}`
  }

  if (from && to && limit){
    exercisesQuery = `SELECT * FROM exercises where author_id='${authorId}' AND created_at BETWEEN ${from} AND ${to} LIMIT ${limit}`
  }
  

  let exercises = [];

  try {
    const dbres = await client.query(exercisesQuery);

    dbres.rows.forEach((exercise)=>{
      exercises.push({
        description: exercise.description,
        duration: exercise.duration,
        date: new Date(exercise.date).toDateString()
      })
    })

  } catch (err) {
    console.error('Error reading records', err.stack);
  }

  const userQuery = `SELECT * FROM users where _id='${authorId}'`;

  try {
    const dbres = await client.query(userQuery);
    const user = dbres.rows[0];

    res.json({
      username: user.username,
      count: exercises.length,
      _id: authorId,
      logs: exercises
    })

  } catch (err) {
    console.error('Error reading records', err.stack);
  }

})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
