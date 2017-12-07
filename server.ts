import { Server } from "ws";
import * as express from "express";

import * as http from "http";
import * as multer from 'multer'
const client = require("./model/redis");
const app = express();
const server = http.createServer(app);

const uploader = multer({
  dest: '/files',
})

const router = express.Router()

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post('/upload', uploader.single('file'), (req, res, next) => {
  res.send((req as any).file)
  res.status(200)
  next()
})

app.use('/files', express.static('/files'))

let rooms = {};

const ws = new Server({ server });
ws.on("connection", (socket, request) => {
  let username = "";
  let room = "";

  socket.on("message", data => {
    const send = data => socket.send(JSON.stringify(data));
    try {
      const json = JSON.parse(data as string);
      if (!json.type) throw "You sent an invalid data format";
      switch (json.type) {
        case "join": {
          client
            .joinRoom(json.data.username, json.data.room)
            .then(() => {
              send({
                type: "join_success",
                data: { room: json.data.room }
              });
              return Promise.all([
                client.getMessages(json.data.room),
                client.getMembers(json.data.room)
              ]);
            })
            .then(data => {
              send({ type: "history", data: data[0] });
              send({ type: "members", data: data[1] });

              rooms[json.data.room] = rooms[json.data.room] || [];
              rooms[json.data.room].forEach(socket => {
                try {
                  socket.send(
                    JSON.stringify({
                      type: "joined",
                      data: {
                        name: json.data.username
                      }
                    })
                  );
                } catch {}
              });
              rooms[json.data.room].push(socket);
              username = json.data.username;
              room = json.data.room;
            })
            .catch(error => {
              if (error instanceof Error)
                socket.send(
                  JSON.stringify({
                    error: error.message
                  })
                );
            });

          break;
        }
        case "message": {
          if (!room || !username)
            return send({
              error: "You must have a room before you can send a message"
            });
          const message = json.data.message;
          const sockets = rooms[room] || [];
          client.saveMessage(username, room, message).then(() => {
            sockets.forEach(socket => {
              try {
                socket.send(
                  JSON.stringify({
                    type: "message",
                    data: {
                      message,
                      author: username
                    }
                  })
                );
              } catch (error) {}
            });
          });
        }
        case "leave": {
          if (!room || !username)
            return send({
              error: "Please join a room before leaving"
            });
          rooms[room] = rooms[room].filter(room => room !== socket);
          client.leaveRoom(username, room);
          rooms[room].forEach(socket => {
            try {
              socket.send(
                JSON.stringify({
                  type: "left",
                  data: {
                    username
                  }
                })
              );
            } catch (error) {}
          });
        }
        default:
          throw 'Invalid instruction type. Please use any of the following: "join", "message", "leave" ';
      }
    } catch (e) {
      // do nothing if this fails
      console.log(e);
      socket.send(
        JSON.stringify({
          error: e
        })
      );
    }
  });
  socket.on("close", (code, reason) => {
    if (!room || !username) return null
    rooms[room] = rooms[room].filter(room => room !== socket);
    client.leaveRoom(username, room);
    rooms[room].forEach(socket => {
      try {
        socket.send(JSON.stringify({ type: "left", data: { username } }));
      } catch (error) {}
    });
  });
});


server.listen(80, () => {
  console.log("listening on 8000");
});
