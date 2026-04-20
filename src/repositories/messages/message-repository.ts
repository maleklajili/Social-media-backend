import { ObjectId } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type {
  CallPayload,
  Message,
  MessagePayload,
} from "../../models/messages/message";
import type { IMessageRepository } from "../../interfaces/message/i-message-repository";

export class MessageRepository implements IMessageRepository {
  private collection = CollectionsManager.messageCollection;

  async sendMessage(message: Message): Promise<void> {
    await this.collection.insertOne(message);
  }

  async deleteAllGroupMessages(groupId: ObjectId): Promise<number> {
    const result = await this.collection.deleteMany({ groupId });
    return result.deletedCount || 0;
  }
  async getConversation(
    user1Id: ObjectId,
    user2Id: ObjectId,
    currentUserId: ObjectId,
  ): Promise<Message[]> {
    return await this.collection
      .find({
        $or: [
          { sender: user1Id, receiver: user2Id },
          { sender: user2Id, receiver: user1Id },
        ],
        deletedFor: { $ne: currentUserId },
      })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async markAsRead(messageIds: ObjectId[]): Promise<void> {
    await this.collection.updateMany(
      { _id: { $in: messageIds } },
      { $set: { read: true } },
    );
  }

  async getMessageById(id: ObjectId): Promise<Message | null> {
    return await this.collection.findOne({ _id: id });
  }

  async deleteMessage(id: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, sender: userId });
    return result.deletedCount === 1;
  }

  async deleteConversation(
    user1Id: ObjectId,
    user2Id: ObjectId,
  ): Promise<number> {
    const result = await this.collection.deleteMany({
      $or: [
        { sender: user1Id, receiver: user2Id },
        { sender: user2Id, receiver: user1Id },
      ],
    });
    return result.deletedCount || 0;
  }
  async getGroupConversation(
    groupId: ObjectId,
    currentUserId: ObjectId,
  ): Promise<Message[]> {
    return this.collection
      .find({
        groupId,
        deletedFor: { $ne: currentUserId },
      })
      .sort({ createdAt: 1 })
      .toArray();
  }
  async countUnreadGroupMessages(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<number> {
    return this.collection.countDocuments({
      groupId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
      deletedFor: { $ne: userId },
    });
  }

  async getLastGroupMessage(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<Message | null> {
    const messages = await this.collection
      .find({ groupId, deletedFor: { $ne: userId } })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (messages.length === 0) return null;
    return messages[0] as unknown as Message;
  }
  async markGroupMessagesAsRead(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<void> {
    await this.collection.updateMany(
      {
        groupId,
        readBy: { $ne: userId },
        sender: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      },
    );
  }
  async getRecentChats(userId: ObjectId): Promise<Message[]> {
    const pipeline = [
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          deletedFor: { $ne: userId },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: { newRoot: "$lastMessage" },
      },
      {
        $sort: { createdAt: -1 },
      },
    ];

    const recentChats = await this.collection.aggregate(pipeline).toArray();
    return recentChats as Message[];
  }

  async countUnreadMessages(
    userId: ObjectId,
    otherUserId: ObjectId,
  ): Promise<number> {
    return this.collection.countDocuments({
      sender: otherUserId,
      receiver: userId,
      read: false,
      deletedFor: { $ne: userId },
    });
  }

  async deleteAllMessagesByUser(userId: ObjectId): Promise<number> {
    const result = await this.collection.deleteMany({ sender: userId });
    return result.deletedCount || 0;
  }

  async findMessagesByIds(ids: ObjectId[]): Promise<Message[]> {
    return await this.collection.find({ _id: { $in: ids } }).toArray();
  }

  async updateMessage(
    messageId: ObjectId,
    userId: ObjectId,
    payload: MessagePayload,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: messageId, sender: userId },
      { $set: { payload, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }
  async updateCallPayload(
    messageId: ObjectId,
    payload: CallPayload,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: messageId },
      { $set: { payload, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async softDeleteConversationForUser(
    user1Id: ObjectId,
    user2Id: ObjectId,
    userId: ObjectId,
  ): Promise<number> {
    const result = await this.collection.updateMany(
      {
        $or: [
          { sender: user1Id, receiver: user2Id },
          { sender: user2Id, receiver: user1Id },
        ],
        deletedFor: { $ne: userId },
      },
      { $addToSet: { deletedFor: userId } },
    );
    return result.modifiedCount;
  }

  async softDeleteMessage(
    messageId: ObjectId,
    userId: ObjectId,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: messageId, deletedFor: { $ne: userId } },
      { $addToSet: { deletedFor: userId } },
    );
    return result.modifiedCount > 0;
  }

  async getMessageMediaUrl(messageId: ObjectId): Promise<string | null> {
    const message = await this.collection.findOne(
      { _id: messageId },
      { projection: { "payload.url": 1, type: 1 } },
    );

    if (message?.payload && "url" in message.payload) {
      return message.payload.url;
    }

    return null;
  }

  async searchMessages(userId: ObjectId, query: string): Promise<Message[]> {
    const searchRegex = new RegExp(query, "i");
    return await this.collection
      .find({
        $and: [
          {
            $or: [{ sender: userId }, { receiver: userId }],
          },
          {
            $or: [{ "payload.text": searchRegex }],
          },
          { deletedFor: { $ne: userId } },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();
  }
  async softDeleteGroupConversationForUser(
    groupId: ObjectId,
    userId: ObjectId,
  ): Promise<number> {
    const result = await this.collection.updateMany(
      { groupId, deletedFor: { $ne: userId } },
      { $addToSet: { deletedFor: userId } },
    );
    return result.modifiedCount;
  }
  async removeMember(groupId: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: groupId },
      { $pull: { members: userId } },
    );
    return result.modifiedCount > 0;
  }
}
