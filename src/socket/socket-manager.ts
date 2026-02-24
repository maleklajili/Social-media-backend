// socket/socket-manager.ts
import { Server as SocketServer } from "socket.io";
import { verifyToken } from "../utils/j-w-t";
import jwt from "jsonwebtoken";

let io: SocketServer;

interface TokenPayload extends jwt.JwtPayload {
  id?: string;
  userId?: string;
  _id?: string;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
export const initSocket = (bunServer: any) => {
  console.log("🔌 [Socket] Initialisation...");

  // ✅ Simple et propre - on passe le serveur Bun directement
  io = new SocketServer(bunServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
    path: "/socket.io/",
  });

  // Middleware d'auth
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Token manquant"));

      const decoded = await verifyToken(token);
      if (decoded instanceof Response) return next(new Error("Token invalide"));

      const payload = decoded as TokenPayload;
      const userId = payload.id || payload.userId || payload._id;
      if (!userId) return next(new Error("UserId manquant"));

      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Erreur d'authentification"));
    }
  });

  // Gestion des connexions
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(`✅ User ${userId} connected`);

    socket.join(`user:${userId}`);
    socket.emit("connected", { userId, socketId: socket.id });

    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected: ${reason}`);
    });
  });

  console.log("✅ [Socket] Prêt !");
  return io;
};

export const getIo = () => {
  if (!io) throw new Error("Socket.IO non initialisé");
  return io;
};
