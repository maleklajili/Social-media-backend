// socket/socket-manager.ts (version améliorée)
import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken } from "../utils/j-w-t";
import jwt from "jsonwebtoken";

let io: SocketServer;

interface TokenPayload extends jwt.JwtPayload {
  id?: string;
  userId?: string;
  _id?: string;
}

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3001",
      credentials: true,
    },
    // Ajoutez ces options pour plus de fiabilité
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.error("Socket auth: Token manquant");
        return next(new Error("Token manquant"));
      }

      console.log(
        "Socket auth: Tentative avec token:",
        token.substring(0, 20) + "...",
      );

      const decoded = await verifyToken(token);

      // Vérifier si decoded est une Response (cas d'erreur)
      if (decoded instanceof Response) {
        console.error("Socket auth: Token invalide (Response)");
        return next(new Error("Token invalide"));
      }

      const payload = decoded as TokenPayload;
      const userId = payload.id || payload.userId || payload._id;

      if (!userId) {
        console.error("Socket auth: UserId manquant dans le token", payload);
        return next(new Error("UserId manquant dans le token"));
      }

      socket.data.userId = userId;
      console.log(`Socket auth: Utilisateur ${userId} authentifié avec succès`);
      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Erreur d'authentification"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(`User ${userId} connected with socket ID: ${socket.id}`);

    // Rejoindre une room personnelle
    socket.join(`user:${userId}`);

    // Émettre un événement de confirmation
    socket.emit("connected", { userId, socketId: socket.id });

    socket.on("disconnect", (reason) => {
      console.log(`User ${userId} disconnected. Reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.IO non initialisé");
  }
  return io;
};
