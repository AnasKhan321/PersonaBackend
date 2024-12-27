import express from 'express'
import cors from "cors"
import http from "http"
import {Server}  from "socket.io"
import Redis from 'ioredis'
import  { generateSlug } from 'random-word-slugs'
import {RunewContainer  , aidata} from "./utils/index.js"
import dotenv from "dotenv"
dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())

const redisclient1 = new Redis(process.env.REDIS_URL )
const redisclient2 = new Redis(process.env.REDIS_URL)
const server = http.createServer(app)



const io = new Server(server , {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
      }
})

io.on("connection"  , (socket)=>{
    socket.on("PersonCreate"  , async(data)=>{
        let username = JSON.parse(data).username
        let rdata =  await redisclient2.get(username)  
        if(rdata !== null){
            socket.emit("userfound"  , rdata)
        }else{
            let slug = generateSlug() ; 
            await redisclient1.subscribe(slug)
            await redisclient2.set(socket.id , slug)
            await RunewContainer(slug ,username)
        }


    })

    socket.on("message"  , async(data)=>{
        const sdata = JSON.parse(data)
        const rrdata  = await redisclient2.get(sdata.username)
        const ssdata = JSON.parse(rrdata)
        const sprompt = `Hy my name is ${ssdata.name}  my twitter description is this ${ssdata.description} and here is my recent Tweets list : 
            TWEETS :
                ${ssdata.data}

            You have to clone my personality based on my tweets remember you are not ai you are ${ssdata.name}  and Just give the content 
            Just give the content
        `
        const rdata = await aidata(sprompt , sdata.question)
        io.to(socket.id).emit("send:message"  , JSON.stringify( {image : rrdata.image , message : rdata[0].text}))
    })

    redisclient1.on("message"  , async(channel , message)=>{
        const schannel =  await redisclient2.get(socket.id) 
        if(schannel == channel){
            const data=  JSON.parse(message)
            console.log(JSON.parse(message))
            console.log(data.success)

            if(data.success ){
                await redisclient2.set(data.username  , message)
                socket.emit("userfound"  , message)
                
            }else{
                socket.emit("usernotfound"  , JSON.stringify({success : false}))
            }
        }
    })
}) 



app.get("/userinfo/:name"  , async(req,res)=>{
    try {
        const name = req.params.name
        const data = await redisclient2.get(name)

        res.json({success : true , data : JSON.parse(data )})
    } catch (error) {

        res.json({success : false})
        
    }
})

server.listen(8000 , ()=>{console.log("Server is listening ")})