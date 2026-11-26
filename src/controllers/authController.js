const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const City = require("../models/City");
const { ApiError } = require("../middleware/error");

function publicUser(user) {
  return {
    userId: user.id || String(user._id),
    fullName: user.fullName,
    email: user.email,
    selectedCityId: user.selectedCityId,
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function register(req, res, next) {
  try {
    const { fullName, email, password, selectedCityId } = req.body;
    const normalizedEmail = email.toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      throw new ApiError(409, "An account with this email already exists");
    }
    const city = await City.findOne({ id: selectedCityId });
    if (!city) throw new ApiError(400, "selectedCityId must reference a live city");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
      selectedCityId,
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }
    res.status(200).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.status(200).json({
    ...publicUser(req.user),
    notificationsEnabled: req.user.notificationsEnabled,
  });
}

module.exports = { register, login, me, publicUser };
