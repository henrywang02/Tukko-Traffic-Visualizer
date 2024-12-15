// auth.controller.ts

import { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from './user.model'; // Import the User model
import bodyParser from 'body-parser';
import { conn_string } from './mongo';
import mongoose from 'mongoose';
import * as dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

export const authRouter = Router()
if (!conn_string) {
  console.error("DB_CONN_STRING environment variable is not defined");
  process.exit(1);
}
mongoose.connect(conn_string);

// Define your JWT secret key here
const JWT_SECRET = process.env.JWT_SECRET;


export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ message: 'User already exists' });
        return;
      }
    } catch (e) {
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({ username, email, password: hashedPassword });
    try {
      await newUser.save();
    } catch (e) {
      console.log(e)
    }

    res.status(201).json(JSON.stringify({ message: 'User registered successfully' }));
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    // Check if user exists

    console.log(await User.find({}))
    console.log(req.body)
    const user = await User.findOne({ email: username });
    console.log(user)
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return
    }

    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(400).json({ error: `Server does not set the cookie on the client nor stores it. 
  So sending logout request won't do anything on the server side. 
  You should delete the client side cookie from the local storage.`, identifier: "absurd_request" })
}


authRouter.post("/login", bodyParser.json(), login)
authRouter.post("/register", bodyParser.json(), register)
authRouter.post("/logout", bodyParser.json(), logout)

