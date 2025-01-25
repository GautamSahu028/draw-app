import express from "express";
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

const app = express();
app.use(express.json());
app.use(cors());
const port = 3001;

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
        // TODO: Hash the pw
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
