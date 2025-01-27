import ws, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend/config";
import { WS_PORT } from "@repo/backend/config";
import { prismaClient } from "@repo/db";

const wss = new WebSocketServer({ port: WS_PORT });

interface User {
  ws: ws;
  rooms: string[];
  userId: string;
}
const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded === "string" || !decoded.userId) {
      return null;
    }
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

wss.on("connection", (ws, req) => {
  const url = req.url || "";
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);
  if (!userId) {
    ws.send("Unauthorized");
    ws.close();
    return;
  }
  users.push({
    ws,
    userId,
    rooms: [],
  });
  ws.on("message", async (message: string) => {
    const parsedData = JSON.parse(message);
    if (parsedData.type === "join") {
      const user = users.find((u) => u.ws === ws);
      user?.rooms.push(parsedData.roomId);
    }
    if (parsedData.type === "leave") {
      const user = users.find((u) => u.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user?.rooms.filter((r) => r !== parsedData.roomId);
    }
    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;
      const user = users.find((u) => u.ws === ws);
      if (!user) {
        return;
      }
      await prismaClient.chat.create({
        data: {
          roomId: parseInt(roomId),
          userId,
          message,
        },
      });
      const roomUsers = users.filter((u) => u.rooms.includes(roomId));
      roomUsers.forEach((u) => {
        u.ws.send(
          JSON.stringify({
            type: "chat",
            roomId,
            message,
            userId: user.userId,
          })
        );
      });
    }
  });
});
