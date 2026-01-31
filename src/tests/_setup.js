import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo = null

export async function startMongo() {
  mongo = await MongoMemoryServer.create({
    instance: { launchTimeout: 60_000 }
  })
  const uri = mongo.getUri()
  await mongoose.connect(uri)
  return uri
}

export async function stopMongo() {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect()
  }
  if (mongo) {
    await mongo.stop()
    mongo = null
  }
}

export async function resetDb() {
  if (mongoose.connection.readyState && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase()
  }
}
