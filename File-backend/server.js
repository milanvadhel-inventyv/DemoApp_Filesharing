const express = require("express");
const app = express();
const cors = require("cors");
const db = require("./db");
const minio = require("minio");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const multer = require("multer");
const Message = require("./Models/Message");
const { error } = require("console");
const { type } = require("os");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
require("dotenv").config();

app.use(express.json()); // Built-in middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());
app.use(bodyParser.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const minioclient = new minio.Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_accesskey,
  secretKey: process.env.MINIO_secretkey,
});
const BUCKET = "data";

(async () => {
  const bucket = await minioclient.bucketExists(BUCKET);
  if (!bucket) {
    await minioclient.makeBucket(BUCKET);
  }
})();
const upload = multer({
  storage: multer.memoryStorage(),
});

const Rooms = {};
io.on("connection", (socket) => {
  console.log("User Connected with", socket.id);
  (socket.on("room-joined", ({ room, username }) => {
    console.log(`${socket.id} joined  room:${room}`);
    socket.join(room);
    if (!Rooms[room]) {
      Rooms[room] = [];
    }
    Rooms[room].push({
      socketId: socket.id,
      username,
      room,
    });
    io.to(room).emit("room-users", Rooms[room]);
    socket.emit("user-joined", {
      username,
      socketId: socket.id,
    });
  }),
    socket.on("disconnect", () => {
      for (let room in Rooms) {
        Rooms[room] = Rooms[room].filter((user) => user.socketId !== socket.id);

        io.to(room).emit("room-users", Rooms[room]);
      }

      console.log("User disconnected:", socket.id);
    }));
});

app.get("/messages/:roomId", async (req, res) => {
  const messages = await Message.find({ room: req.params.roomId }).sort({
    createdAt: 1,
  });

  res.json(messages);
});
const sanitizeFilename = (name) => {
  return name.replace(/[^\w.-]/g, "_");
};

app.post("/File-upload", upload.single("file"), async (req, res) => {
  try {
    const { username, room } = req.body;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "File not uploaded" });
    }
    const safeName = sanitizeFilename(file.originalname);
    const objectName = `${Date.now()}-${safeName}`;
    await minioclient.putObject(BUCKET, objectName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });
    const fileUrl = `http://localhost:9000/${BUCKET}/${objectName}`;
    console.log(fileUrl);
    const message = await Message.create({
      sender: username,
      room,
      file: {
        filename: file.originalname,
        fileurl: fileUrl,
        filesize: file.size,
        mimetype: file.mimetype,
      },
    });
    io.to(room).emit("new-message", message);
    res.status(200).json({
      success: true,
      message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

//file upload via chunks

app.post("/Chunk-upload", upload.single("chunk"), async (req, res) => {
  const { chunkIndex, uploadId } = req.body;
  const chunk = req.file.buffer;
  const temp = `./temp/${uploadId}`;
  try {
    await fs.mkdir(temp, { recursive: true });
    chunkPath = `${temp}/${chunkIndex}.chunk`;
    await fs.writeFile(chunkPath, chunk);
    res.json({ message: "chunk stored" });
  } catch (err) {
    console.log("Chunks error", err);
    res.status(500).json({ message: "Chunk upload failed" });
  }
});

//Merge CHunks
app.post("/Merge-Chunk", async (req, res) => {
  try {
    console.log("Merge Chunk");
    const { uploadId, totalChunks, filename, mimetype, room, username } =
      req.body;
    console.log("file types:", mimetype);
    const temp = `./temp/${uploadId}`;
    const finalpath = path.join(temp, "final");
    const writestream = fsSync.createWriteStream(finalpath);

    for (let i = 0; i < parseInt(totalChunks); i++) {
      const chunkpath = path.join(temp, `${i}.chunk`);
      if (!fsSync.existsSync(chunkpath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
      const chunkdata = await fs.readFile(chunkpath);
      writestream.write(chunkdata);
      await fs.unlink(chunkpath);
      // await fs.rmdir(finalpath);
    }
    writestream.end();
    await new Promise((resolve) => writestream.on("finish", resolve));
    const safeName = sanitizeFilename(filename);
    const objectName = `${Date.now()}-${safeName}`;
    readstream = fsSync.createReadStream(finalpath);
    await minioclient.putObject(BUCKET, objectName, readstream, {
      "Content-Type": mimetype,
    });
    await fs.unlink(finalpath);
    await fs.rm(temp, { recursive: true, force: true });
    const fileUrl = `http://localhost:9000/${BUCKET}/${objectName}`;
    console.log(fileUrl);
    const message = await Message.create({
      sender: username,
      room,
      file: {
        filename: filename,
        fileurl: fileUrl,
        filesize: null,
        mimetype: null,
      },
    });
    io.to(room).emit("new-message", message);
    res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.log("Chunks-Merge error", err);
    res.status(500).json({ message: "Chunks Merge Error : " + err });
  }
});

app.get("/download", async (req, res) => {
  try {
    const { fileurl } = req.query;

    // Extract objectName from URL
    const objectName = decodeURIComponent(fileurl.split("/").pop());

    const presignedUrl = await minioclient.presignedGetObject(
      BUCKET,
      objectName,
      60 * 5,
      {
        "response-content-disposition": `attachment; filename="${objectName}"`,
      },
    );

    res.json({ url: presignedUrl });
  } catch (err) {
    res.status(500).json({ error: "Download failed" });
  }
});
server.listen(5000, () => {
  console.log("server is listing port no:5000");
});
