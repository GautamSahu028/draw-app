import express, { Request } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend/config";
import { prismaClient } from "@repo/db";
import {
  CreateUserSchema,
  SigninSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import cors from "cors";
import { middleware } from "./middleware.js";
import bcrypt from "bcrypt";
import { SALT } from "@repo/backend/config";
import { PORT } from "@repo/backend/config";

interface CustomRequest extends Request {
  userId?: string;
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.json());

app.post("/signup", async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect inputs",
      error: parsedData.error,
    });
    return;
  }
  const hashedPassword = await bcrypt.hash(parsedData.data.password, SALT);
  try {
    const user = await prismaClient.user.create({
      data: {
        email: parsedData.data?.email,
        password: hashedPassword,
        name: parsedData.data.name,
      },
    });
    res.json({
      userId: user.id,
    });
  } catch (e) {
    res.status(411).json({
      message: "User already exists with this email",
      error: e,
    });
  }
});

app.post("/signin", async (req, res) => {
  const parsedData = SigninSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect inputs",
      error: parsedData.error,
    });
    return;
  }
  try {
    const user = await prismaClient.user.findUnique({
      where: {
        email: parsedData.data?.email,
      },
    });
    if (!user) {
      res.json({
        message: "User not found",
      });
      return;
    }
    const isValid = await bcrypt.compare(
      parsedData.data.password,
      user.password
    );
    if (!isValid) {
      res.json({
        message: "Incorrect password",
      });
      return;
    }
    const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET);
    res.json({
      token,
    });
  } catch (e) {
    res.status(500).json({
      message: "Internal server error",
      error: e,
    });
  }
});

app.post("/room", middleware, async (req: CustomRequest, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.json({
      message: "Incorrect inputs",
    });
    return;
  }

  const userId = req.userId;

  if (!userId) {
    res.status(400).json({
      message: "Something went wrong",
    });
    return;
  }

  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });

    res.json({
      roomId: room.id,
    });
  } catch (e) {
    res.status(411).json({
      message: "Room already exists with this name",
    });
  }
});

app.get("/chats/:roomId", async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    console.log(req.params.roomId);
    const messages = await prismaClient.chat.findMany({
      where: {
        roomId: roomId,
      },
      orderBy: {
        id: "desc",
      },
      take: 50,
    });

    res.json({
      messages,
    });
  } catch (e) {
    console.log(e);
    res.json({
      messages: [],
    });
  }
});

app.get("/room/:slug", async (req, res) => {
  const slug = req.params.slug;
  const room = await prismaClient.room.findFirst({
    where: {
      slug,
    },
  });

  res.json({
    room,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
