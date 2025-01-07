import  { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'
import dotenv from "dotenv"
import Anthropic from "@anthropic-ai/sdk";
import {redisclient1 , redisclient2}  from "../index.js"
import { json } from 'express';
dotenv.config() ; 

const anthropic = new Anthropic();

const ecsClient = new ECSClient({ 
    region: process.env.AWS_REGION  ,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID   ,
        secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET  
    }
})


const config = {
    CLUSTER: process.env.AWS_CLUSTER  ,
    TASK: process.env.AWS_TASK  
}


const hastoupdateProfile = [
    "brockpierce"  , 
    "Cristiano"  , 
    "elonmusk"  , 
    "FacesearchAI"  , 
    "imVkohli" , 
    "jackjayio"  , 
    "morgan_freeman"  , 
    "taylorswift13"
]



export const RunewContainer = async( redischannel    , username  )=>{

    const command = new RunTaskCommand({
        cluster: config.CLUSTER  ,
        taskDefinition: config.TASK  ,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-088117033df2f6c23', 'subnet-0ab3f4e0da7b896fc', 'subnet-09316e97b45c1a202'],
                securityGroups: ['sg-0e8d35b6015762619']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: process.env.AWS_TASK_IMAGE_NAME ,
                    environment: [
                        { name: "username", value: username },
                        { name: "redischannel", value: redischannel },
                    ]
                }
            ]
        }
    })
    await ecsClient.send(command)
}








export async function  aidata(systemprompt  , question) {
    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        temperature: 1,
        system: systemprompt , 
        messages: [
            {
            "role": "user",
            "content": [
                {
                "type": "text",
                "text": question
                }
            ]
            }
        ]
        });
        console.log(msg.content);
        return msg.content
}


export async function  ReplyAi(systemprompt , question) {
    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        temperature: 1,
        system: systemprompt , 
        messages: [
            {
            "role": "user",
            "content": [
                {
                "type": "text",
                "text": question
                }  , 
            ]
            }  , 
           
        ]
        });
        console.log(msg.content);
        return msg.content
}



export async function  updateProfile(username ) {
    let rdata =  await redisclient2.get(username)

    if(rdata == null){
        console.log("profile doesn't exsists")
        return ; 
    }

    let  q = await redisclient2.get("UpdateUser")
    let queue = JSON.parse(q)

    queue.push(username)

    await redisclient2.set("UpdateUser"  , JSON.stringify(queue))
    await redisclient1.subscribe(username)
    await RunewContainer(username , username)
    console.log(`updating user : ${username}`)



}


export const updateAllProfile = async()=>{
    for(const profile of hastoupdateProfile){
            await updateProfile(profile)
    }
}
