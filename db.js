const { MongoClient } = require("mongodb");

const client = new MongoClient("mongodb+srv://mainUser:RSNGly2ZwbeODgC9@cluster0.i74ongp.mongodb.net/OurAppCourse?retryWrites=true&w=majority");

async function start() {
  await client.connect();
  module.exports = client.db();
  const app = require("./app");
  app.listen(3000);
}

start();
