const express = require("express");
const router = express.Router();
const User = require("../models/userModel.js");
const LoginActivity = require("../models/loginActivityModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secret = "secret";
const authMiddleware = require("../middlewares/authMiddleware.js")
// SIGNUP ROUTE
router.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).send({ message: "Missing details in the signup form" });
    }

    const existingUser = await LoginActivity.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

   

    

    await LoginActivity.create({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      type: "signup",
    });

    const token = jwt.sign({ id: savedUser._id, role: savedUser.role }, secret, {
      expiresIn: "1d",
    });

    return res
      .cookie("token", token, { httpOnly: true })
      .status(200)
      .send({ message: "User has been registered successfully" });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).send({ message: "Internal server error" });
  }
});

// LOGIN ROUTE
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ message: "Missing credentials" });
    }

    const user = await LoginActivity.findOne({ email });
    if (!user) {
      return res.status(400).send({ message: "Email does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ message: "Password is incorrect" });
    }

    await LoginActivity.create({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      password: user.password,
      type: "login",
    });

    const token = jwt.sign({ id: user._id, role: user.role }, secret, {
      expiresIn: "1d",
    });

    return res
      .cookie("token", token, { httpOnly: true })
      .status(200)
      .send({ message: "User has been logged in successfully" });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send({ message: "Internal server error" });
  }
});

// LOGOUT ROUTE
router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token");
    return res.status(200).send({ message: "Cookie has been cleared successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).send({ message: "Internal server error" });
  }
});





module.exports = router;