// socket/socket-server.ts
import { Server as SocketServer } from "socket.io";
import http from "http";
import { verifyToken } from "../utils/j-w-t";
import jwt from "jsonwebtoken";
import { NotificationController } from "../controllers/notification-controller";

let io: SocketServer;

const onlineUsers = new Map<string, string>();

interface TokenPayload extends jwt.JwtPayload {
  id?: string;
  userId?: string;
  _id?: string;
}

export const initSocketServer = (httpServer?: http.Server) => {
  // 🔐 Empêche toute double initialisation
  if (io) {
    console.log("⚠️ [Socket] Socket.IO déjà initialisé");
    return io;
  }

  console.log("🔌 [Socket] Initialisation du serveur Socket.IO...");

  // Si aucun serveur HTTP n'est fourni, en créer un sur un port séparé
  let server: http.Server;
  const useSeparatePort = !httpServer;

  if (useSeparatePort) {
    const SOCKET_PORT = process.env.SOCKET_PORT || 9001;
    server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Socket.IO server running\n");
    });
    server.listen(SOCKET_PORT, () => {
      console.log(`[Socket] Serveur Socket.IO démarré sur port ${SOCKET_PORT}`);
      console.log(
        ` WebSocket disponible à: ws://localhost:${SOCKET_PORT}/socket.io/`,
      );
    });
  } else {
    server = httpServer;
  }

  io = new SocketServer(server, {
    cors: {
      origin: "*",
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
        " [Socket] Auth attempt with token:",
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
      console.log(` [Socket] Auth successful for user ${userId}`);
      next();
    } catch (error) {
      console.error(" [Socket] Auth error:", error);
      next(new Error("Erreur d'authentification"));
    }
  });

  // Gestion des connexions
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(` [Socket] User ${userId} connected with ID ${socket.id}`);
    console.log(`📌 Transport utilisé:`, socket.conn.transport.name);

    // Marquer l'utilisateur comme en ligne
    const wasAlreadyOnline = onlineUsers.has(userId);
    onlineUsers.set(userId, socket.id);
    console.log(` [Socket] User ${userId} is now ONLINE`);
    console.log(
      ` [Socket] Current online users: ${Array.from(onlineUsers.keys()).join(", ")}`,
    );

    // Joindre la room de l'utilisateur
    socket.join(`user:${userId}`);
    console.log(`📌 [Socket] User ${userId} joined room user:${userId}`);

    // Utiliser io.emit au lieu de socket.broadcast pour s'assurer que tout le monde reçoit
    if (!wasAlreadyOnline) {
      socket.broadcast.emit("user-status-update", {
        userId,
        isOnline: true,
        lastSeen: new Date(),
      });
      console.log(` [Socket] Broadcasted user-status-update for ${userId}`);
    }

    // Envoyer la liste des utilisateurs en ligne au nouveau client
    const onlineUsersList = Array.from(onlineUsers.keys());
    socket.emit("online-users-list", onlineUsersList);
    console.log(` [Socket] Sent online list to ${userId}:`, onlineUsersList);

    socket.emit("connected", {
      userId,
      socketId: socket.id,
      message: "Socket connected successfully",
      onlineUsers: onlineUsersList,
    });

    // Gérer la demande de statut d'un utilisateur
    socket.on("get-user-status", (data: { userId: string }) => {
      const isUserOnline = onlineUsers.has(data.userId);
      socket.emit("user-status-response", {
        userId: data.userId,
        isOnline: isUserOnline,
        lastSeen: isUserOnline ? new Date() : undefined,
      });
    });

    // Gérer la demande de tous les utilisateurs en ligne
    socket.on("get-online-users", () => {
      const onlineUsersList = Array.from(onlineUsers.keys());
      console.log(
        `[Socket] Sending online list to ${userId}:`,
        onlineUsersList,
      );
      socket.emit("online-users-list", onlineUsersList);
    });

    // Écouter l'événement user:join du frontend
    socket.on("user:join", (data: { userId: string }) => {
      console.log(` [Socket] User ${data.userId} joined via user:join event`);
      if (!onlineUsers.has(data.userId)) {
        onlineUsers.set(data.userId, socket.id);
        socket.broadcast.emit("user:joined", { userId: data.userId });
        socket.broadcast.emit("user-status-update", {
          userId: data.userId,
          isOnline: true,
          lastSeen: new Date(),
        });
      }
    });

    socket.on(
      "message-read",
      (data: { messageId: string; conversationId: string }) => {
        console.log(
          ` [Socket] User ${userId} read message ${data.messageId} in conversation ${data.conversationId}`,
        );

        socket.to(`user:${data.conversationId}`).emit("message-read", {
          messageId: data.messageId,
          conversationId: data.conversationId,
        });
      },
    );

    // Gérer la déconnexion
    socket.on("disconnect", (reason) => {
      console.log(` [Socket] User ${userId} disconnected: ${reason}`);

      // Marquer l'utilisateur comme hors ligne
      onlineUsers.delete(userId);
      console.log(` [Socket] User ${userId} is now OFFLINE`);
      console.log(
        ` [Socket] Remaining online users: ${Array.from(onlineUsers.keys()).join(", ")}`,
      );

      // Notifier tous les autres utilisateurs que cet utilisateur est hors ligne
      socket.broadcast.emit("user-status-update", {
        userId,
        isOnline: false,
        lastSeen: new Date(),
      });

      socket.broadcast.emit("user:left", { userId });
    });

    socket.on("error", (error) => {
      console.error(` [Socket] Error for user ${userId}:`, error);
    });

    socket.on(
      "typing",
      (data: { conversationId: string; isTyping: boolean }) => {
        console.log(
          ` [Socket] User ${userId} typing in ${data.conversationId}: ${data.isTyping}`,
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
        ` [Socket] User ${userId} viewed conversation ${data.conversationId}`,
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

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.IO non initialisé");
  }
  return io;
};

export const getOnlineUsers = () => onlineUsers;
