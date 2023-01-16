import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs"
dotenv.config()

const server = express();
server.use(express.json())
server.use(cors())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;

try {
  await mongoClient.connect()
  db = mongoClient.db()
  console.log('Conectado')
} catch (error) {
  console.log('Deu errro no server')
}

server.post("/participants", async (req, res) => {
    const { name } = req.body;

    const participantsSchema = joi.object({
        name: joi.string().required()
    });
    
    const validation = participantsSchema.validate({name})

    if (validation.error) {
        const erros = validation.error.details.map((err) => {
            return err.message
        })
        return res.status(422).send(erros)
    }

    try {
        const participantsExists = await db.collection("participants").findOne({ name : name})
        if (participantsExists){
            return res.sendStatus(409)
        }

        await db.collection("participants").insertOne ({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({ 
            from : name,
            to : "Todos",
            text : "entra na sala...",
            type : "status",
            time : dayjs().format("HH:MM:SS")
        })
        return res.sendStatus(201)
    }
    catch (err){
        console.log(err)
        res.sendStatus(422)
    }

});

server.get("/participants", async (req, res) => {
   try {
   const participants = await db.collection("participants").find().toArray()
   return res.send(participants)
}
catch (err){
    console.log(err)
    res.sendStatus(500)
}
});
server.listen(5000, () => {
    console.log('Servidor Funcionando!!!')
  })