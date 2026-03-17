const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "student", "employer"], required: true },
  organization: { type: String, default: null },
  rollNumber: { type: String, default: null },
  name: { type: String, default: null },
  degree: { type: String, default: null },
  company: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(passwordToCheck) {
  return bcrypt.compare(passwordToCheck, this.password);
};

module.exports = mongoose.model("User", userSchema);