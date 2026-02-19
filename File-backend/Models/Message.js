const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
  },
  room: {
    type: String,
    required: true,
  },
  file: {
    filename: String,
    fileurl: String,
    filesize: Number,
    mimetype: String,
  },
  CreatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Message", MessageSchema);
