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

    const validation = participantsSchema.validate({ name })

    if (validation.error) {
        const erros = validation.error.details.map((err) => {
            return err.message
        })
        return res.status(422).send(erros)
    }

    try {
        const participantsExists = await db.collection("participants").findOne({ name: name })
        if (participantsExists) {
            return res.sendStatus(409)
        }

        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
        })
        return res.sendStatus(201)
    }
    catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

});

server.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        return res.send(participants)
    }
    catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
});

server.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().required().valid("message", "private_message"),
        time: joi.string()
    });

    const message = {
        from: user,
        to,
        text,
        type,
        time: dayjs().format("HH:mm:ss"),
    }

    try {

        const validation = messageSchema.validate(message, { abortEarly: false });

        if (validation.error) {
            const erros = validation.error.details.map((err) => {
                return err.message
            })
            return res.status(422).send(erros)
        }

        await db.collection("messages").insertOne(message)

        res.sendStatus(201)

    }
    catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})
server.get("/messages", async (req, res) => {
    const { user } = req.headers
    const { limit } = req.query

    try {

        const messages = await db.collection("messages").find(
            {
                $or: [{ to: 'Todos' },
                { to: user },
                { from: user }]
            })
            .toArray()
        return res.send(messages.reverse().slice(limit))


    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})
server.post("/status", async (req, res) => {
    const { user } = req.headers;

  
    try {
      const usuario = await db.collection("participants").findOne({ name: user });
    
      if (!usuario) return res.status(404);
  
      await db.collection("participants").
      updateOne({ name: user },
      { $set: { lastStatus: Date.now() } });
      return res.status(200)
  
    } catch (error) {
      console.log(error);
      res.status(500)
    }
})
setInterval(async () => {
    try {
        const allUsers = await db.collection("participants").find().toArray();

        for (let user of allUsers) {
            if (dayjs().valueOf() - user.lastStatus > 10000) {
                await db.collection("participants").deleteOne({ _id: user._id });
                await db.collection("messages").insertOne({
                    from: user.name,
                    to: "Todos",
                    text: "saiu da sala...",
                    type: "status",
                    time: dayjs(Date.now()).format("HH:mm:ss"),
                });
            }
        }
    } catch (error) {
        console.log(error);
    }
}, 15000);

server.listen(5000, () => {
    console.log('Servidor Funcionando!!!')
})