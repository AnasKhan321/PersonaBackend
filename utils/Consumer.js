import {SQS}  from "@aws-sdk/client-sqs"
import dotenv from "dotenv"

dotenv.config() ; 


const sqs  = new SQS({

    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.QUEUE_AWS_KEY,
        secretAccessKey: process.env.QUEUE_AWS_SECRET
    }
})

const qurl = process.env.QUEUE_URL

(async()=>{
    while(true){
        
        console.log("this is here")
    }
})()