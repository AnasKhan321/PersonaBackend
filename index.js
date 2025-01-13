import express from 'express'
import cors from "cors"
import http from "http"
import {Server}  from "socket.io"
import Redis from 'ioredis'
import  { generateSlug } from 'random-word-slugs'
import {RunewContainer  , aidata  , ReplyAi} from "./utils/index.js"
import dotenv from "dotenv"
import { startUpdating } from './utils/updateScheduleProfile.js'
import { getfullPrompt  , getOpenAIClient } from './utils/index.js'

dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())

export const redisclient1 = new Redis(process.env.REDIS_URL )
export const redisclient2 = new Redis(process.env.REDIS_URL)
const server = http.createServer(app)
const PORT = process.env.PORT ?? 8000


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
        const prompt = getfullPrompt(ssdata  , [])


        const formattedMessages = [
    
            {
                role: "system", content: prompt
            }  , 
            {
                role : "user"  ,
                content : `${sdata.question}`
            }
        ]
        const openai = getOpenAIClient() 
    
        const completion = await openai.chat.completions.create({
            model: "anthropic/claude-3.5-sonnet",
            messages: formattedMessages,
            temperature: 0.8,
            max_tokens: 2044,
          }); 

        io.to(socket.id).emit("send:message"  , JSON.stringify( {image : rrdata.image , message : completion.choices[0].message.content}))
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


app.post("/message"  , async(req,res)=>{


    try {
        const {username  , recenttweets}  = req.body ; 
        const rrdata  = await redisclient2.get(username)
        const ssdata = JSON.parse(rrdata)
        const sprompt = `Your name is  :  ${ssdata.name}  Your twitter description is this ${ssdata.description} and here is your  recent Tweets list : 
            TWEETS :
              [  ${ssdata.data} 
                
              ]

            You are ${ssdata.name} You have only work You have to generate the tweets Based on the Recent tweets and You have to understand Your personality 
            and then Tweet. You are ${ssdata.name} 

            ROLE : 
                Your Role is to Generate Accurate Tweet as Much as Possible it should feel real.

            The Tweets Generated by You For ${ssdata.name}  Make sure Generate a unique tweet don't do copy paste.

            AI Tweets : 
                [
                     ${recenttweets}
                
                
                ]

            Rules:
            - Never mention being AI
            - No ** or formal language

        `
        const rdata = await aidata(sprompt , "write a great tweet which matches my personality my stardom my aura ? and make sure you just returning the tweet I ask not the things like I feel or Note : like things Understand")
        res.status(200).json({success : true  , tweet :  rdata[0].text  })

    } catch (error) {
        console.log(error)
        res.status(500).json({success : false})
    }
})


app.post("/createprofile"  , async(req,res)=>{
    try {
        const {username} = req.body ; 
        let rdata =  await redisclient2.get(username)
        if(rdata !== null){
            return res.json({success : true ,message : "user already exsists"})
        }
        let q = await redisclient2.get("QueueUser")
        let queue = JSON.parse(q)

        queue.push(username)
        await redisclient2.set("QueueUser"  , JSON.stringify(queue))
        await redisclient1.subscribe(username)
        await RunewContainer(username , username)

        res.json({success : true})
    } catch (error) {
        res.status(500).json({success : false})
    }
})

app.post("/reply"  , async(req,res)=>{
    try {
        const {user , tweetowner , tweet }  = req.body ; 

        const userdata  = await redisclient2.get(user)
        const ownerdata = await redisclient2.get(tweetowner)
        
        let userdata2 = JSON.parse(userdata)

        let ownerdata2 = JSON.parse(ownerdata)

        const prompt = ` You are ${userdata2.name}  Your XUSERNAME : ${userdata2.username}  Your XDESCRIPTION : ${userdata2.description} 
            YOUR TWEETS : ${userdata2.data}
            You have to clone this Person Personality You are ${userdata2.name }  
            Adapt the Personality of this Person through tweets description 
            You are ${userdata2.name}`

        console.log(prompt)

        const rdata = await ReplyAi(prompt , `
                ${ownerdata2.name}  write a new tweet ${tweet}   I have to give him a reply Write a reply For me ? 

                Just give me the reply ? Nothing else ! 

                
            `)



        res.json({success : true , reply :  rdata[0].text   })

    } catch (error) {
        console.log(error)
        res.status(500).json({success : false})
    }
})



redisclient1.on("message"  , async(channel , message)=>{
    let q = await redisclient2.get("QueueUser")
    let queuee = JSON.parse(q)
    console.log(queuee)

    let q2 = await redisclient2.get("UpdateUser")
    let queeu2 = JSON.parse(q2)


    if(queuee.includes(channel)){
        const data=  JSON.parse(message)
  
        if(data.success){
            await redisclient2.set(data.username  , message)
        }

        queuee = queuee.filter(item=> item !== data.username)
        await redisclient2.set("QueueUser"  , JSON.stringify(queuee))


    }else{
        if(queeu2.includes(channel)){
            const data=  JSON.parse(message)
            console.log(data)
            if(data.success){
                await redisclient2.set(data.username  , message)
                console.log("updated")

            }
    
            queeu2 = queeu2.filter(item=> item !== data.username)
            await redisclient2.set("UpdateUser"  , JSON.stringify(queeu2))
        }
    }
})

app.get("/availableProfiles"  , async(req,res)=>{
    let  allusers = await redisclient2.get("AvailableUser")
    allusers = JSON.parse(allusers)
    let data = []


    for(let user of allusers){
        let rdata = await redisclient2.get(user)
        rdata = JSON.parse(rdata)
        data.push(rdata)
    }

    res.json({success : true  , data })
})






server.listen(PORT , ()=>{
    
    // startUpdating() ;    
    console.log(`Server is listening on PORT : ${PORT}`)



})