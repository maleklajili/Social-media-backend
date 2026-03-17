// socket/socket-server.ts
import { Server as SocketServer } from "socket.io";
import http from "http";
import { verifyToken } from "../utils/j-w-t";
import jwt from "jsonwebtoken";
import { NotificationController } from "../controllers/notification-controller";

let io: SocketServer;

interface TokenPayload extends jwt.JwtPayload {
  id?: string;
  userId?: string;
  _id?: string;
}

export const initSocketServer = () => {
  // 🔐 Empêche toute double initialisation

  console.log("🔌 [Socket] Initialisation du serveur Socket.IO séparé...");

  const SOCKET_PORT = process.env.SOCKET_PORT || 6000;

  const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Socket.IO server running\n");
  });
  if (io && httpServer) {
    console.log("⚠️ [Socket] Socket.IO déjà initialisé");
    return io;
  }
  io = new SocketServer(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
      ],
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["authorization", "content-type"],
    },
    transports: ["websocket", "polling"],
    path: "/socket.io/",
    connectTimeout: 45000,
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
  });

  // Middleware d'auth
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      console.log(
        "🔐 [Socket] Auth attempt with token:",
        token ? "présent" : "absent",
      );

      if (!token) {
        return next(new Error("Token manquant"));
      }

      const decoded = await verifyToken(token);
      if (decoded instanceof Response) {
        return next(new Error("Token invalide"));
      }

      const payload = decoded as TokenPayload;
      const userId = payload.id || payload.userId || payload._id;

      if (!userId) {
        return next(new Error("UserId manquant dans le token"));
      }

      socket.data.userId = userId;
      console.log(`✅ [Socket] Auth successful for user ${userId}`);
      next();
    } catch (error) {
      console.error("❌ [Socket] Auth error:", error);
      next(new Error("Erreur d'authentification"));
    }
  });

  // Gestion des connexions
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(
      `✅✅✅ [Socket] User ${userId} connected with ID ${socket.id}`,
    );
    console.log(`📌 Transport utilisé:`, socket.conn.transport.name);

    socket.join(`user:${userId}`);
    console.log(`📌 [Socket] User ${userId} joined room user:${userId}`);

    socket.emit("connected", {
      userId,
      socketId: socket.id,
      message: "Socket connected successfully",
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ [Socket] User ${userId} disconnected: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`❌ [Socket] Error for user ${userId}:`, error);
    });

    socket.on(
      "typing",
      (data: { conversationId: string; isTyping: boolean }) => {
        console.log(
          `✏️ [Socket] User ${userId} typing in ${data.conversationId}: ${data.isTyping}`,
        );
        socket.to(`user:${data.conversationId}`).emit("user_typing", {
          userId,
          conversationId: data.conversationId,
          isTyping: data.isTyping,
        });
      },
    );

    socket.on("view_conversation", (data: { conversationId: string }) => {
      console.log(
        `👀 [Socket] User ${userId} viewed conversation ${data.conversationId}`,
      );
      socket.to(`user:${data.conversationId}`).emit("conversation_viewed", {
        userId,
        conversationId: data.conversationId,
        viewedAt: new Date(),
      });
    });

    // Initialize notification handlers
    const notificationController = new NotificationController();
    notificationController.registerSocketHandlers(socket);
  });

  httpServer.listen(SOCKET_PORT, () => {
    console.log(
      `✅✅✅ [Socket] Serveur Socket.IO démarré sur port ${SOCKET_PORT}`,
    );
    console.log(
      `🔌 WebSocket disponible à: ws://localhost:${SOCKET_PORT}/socket.io/`,
    );
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.IO non initialisé");
  }
  return io;
};
