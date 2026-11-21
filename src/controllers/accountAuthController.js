const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const UserAccount = require("../models/UserAccount");
const { ApiError } = require("../middleware/error");

const RESET_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  return jwt.sign(
    { sub: user.userId, userId: user.userId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function authResponse(user, message) {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    token: createAccessToken(user),
    message,
  };
}

async function signup(req, res, next) {
  try {
    const username = req.body.username.trim();
    const usernameLower = username.toLowerCase();
    const email = req.body.email.trim().toLowerCase();

    const existing = await UserAccount.findOne({
      $or: [{ email }, { usernameLower }],
    }).select("_id");
    if (existing) {
      throw new ApiError(409, "An account with this username or email already exists.");
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await UserAccount.create({
      userId: `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      username,
      usernameLower,
      email,
      passwordHash,
    });

    res.status(201).json(authResponse(user, "Account created successfully"));
  } catch (error) {
    if (error.code === 11000) {
      return next(new ApiError(409, "An account with this username or email already exists."));
    }
    next(error);
  }
}

async function signin(req, res, next) {
  try {
    const identifier = req.body.identifier.trim().toLowerCase();
    const user = await UserAccount.findOne({
      $or: [{ email: identifier }, { usernameLower: identifier }],
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid username/email or password.");
    }

    res.status(200).json(authResponse(user, "Signed in successfully"));
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const submittedEmail = req.body.email.trim();
    const email = submittedEmail.toLowerCase();
    const user = await UserAccount.findOne({ email });

    if (user) {
      const resetToken = crypto.randomBytes(24).toString("hex");
      user.resetToken = resetToken;
      user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
    }

    res.status(200).json({
      userId: "",
      username: "",
      email: submittedEmail,
      token: "",
      message: RESET_MESSAGE,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { signup, signin, forgotPassword };
