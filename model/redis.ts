import { join } from 'path';
import * as redis from 'redis';

enum redisIntegerResponses {
  NOT_SET,
  SET 
}

function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      const callback = (err, data) => {
        if(err)
          return reject(err)
        return resolve(data)
      }
      fn.apply(client, args.concat([callback]))
    })
  }
}

export const client = redis.createClient({
  host: "redis"
});

const get = promisify(client.get)
const setnx = promisify(client.setnx)
const rpush = promisify(client.rpush)
const lrange = promisify(client.lrange)
const lrem = promisify(client.lrem)
const del = promisify(client.del)

async function findOrCreateRoom(roomname) {
  return new Promise((res,rej) => {
    // client.
  })
}


client.on("connect", () => {
  console.log("connected to redis instance");
});

export async function joinRoom(username, roomname) {
  const user = await setnx(`rooms:${roomname}:users:${username}`, 'true');

  if (user == redisIntegerResponses['NOT_SET']) 
    throw new Error("A user with your name has already joined this room. Please choose another name");
  
  await rpush(`rooms:${roomname}:users`, username);
}

export async function leaveRoom(username, roomname) {
  await del(`rooms:${roomname}:users:${username}`);
  await lrem(`rooms:${roomname}:users`, -10000, username);
}

export async function getMembers(roomname): Promise<any> {
  return lrange(`rooms:${roomname}:users`, 0, -1);
}

export async function saveMessage(username, roomname, message) {
  const data = await rpush(
      `rooms:${roomname}:messages`,
      JSON.stringify({
        message,
        author: username
      }))
  return getMessages(roomname);
}

export async function getMessages(roomname) {
  return lrange(`rooms:${roomname}:messages`, 0, -1)
}
  

