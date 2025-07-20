// server/index.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const { type, room, payload } = data;

    if (type === "join") {
      ws.room = room;
      rooms[room] = rooms[room] || [];
      rooms[room].push(ws);
    }

    if (type === "signal") {
      rooms[room]?.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "signal", payload }));
        }
      });
    }

    if (type === "leave") {
      if (rooms[room]) {
        rooms[room] = rooms[room].filter((client) => client !== ws);
        rooms[room].forEach((client) =>
          client.send(JSON.stringify({ type: "leave" }))
        );
      }
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if (room && rooms[room]) {
      rooms[room] = rooms[room].filter((client) => client !== ws);
      rooms[room].forEach((client) =>
        client.send(JSON.stringify({ type: "leave" }))
      );
    }
  });
});

server.listen(3001, () => console.log("WebSocket server on ws://localhost:3001"));
