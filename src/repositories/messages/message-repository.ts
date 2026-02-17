import { ObjectId } from "mongodb";
import { CollectionsManager } from "../../models/base/collection-manager";
import type { Message, MessagePayload } from "../../models/messages/message";
import type { IMessageRepository } from "../../interfaces/message/i-message-repository";

export class MessageRepository implements IMessageRepository {
  private collection = CollectionsManager.messageCollection;

  async sendMessage(message: Message): Promise<void> {
    await this.collection.insertOne(message);
  }

  // ----- MODIFIÉ : ajout du paramètre currentUserId et filtre deletedFor -----
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
        deletedFor: { $ne: currentUserId }, // exclut les messages supprimés pour l'utilisateur courant
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

  // ----- CORRIGÉ : suppression de la ligne erronée avec userId -----
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

  // ----- AMÉLIORÉ : ajout du filtre deletedFor pour les messages reçus aussi -----
  async getRecentChats(userId: ObjectId): Promise<Message[]> {
    const sentMessages = await this.collection
      .find({ sender: userId, deletedFor: { $ne: userId } })
      .project({ receiver: 1 })
      .toArray();
    const receivedMessages = await this.collection
      .find({ receiver: userId, deletedFor: { $ne: userId } }) // filtre ajouté
      .project({ sender: 1 })
      .toArray();

    const contactIds = new Set<ObjectId>();
    sentMessages.forEach((msg) => contactIds.add(msg.receiver));
    receivedMessages.forEach((msg) => contactIds.add(msg.sender));

    const recentChats: Message[] = [];
    for (const contactId of contactIds) {
      const lastMessage = await this.collection
        .find({
          $or: [
            { sender: userId, receiver: contactId },
            { sender: contactId, receiver: userId },
          ],
          deletedFor: { $ne: userId }, // filtre important ici aussi
        })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      if (lastMessage.length > 0) {
        recentChats.push(lastMessage[0]!);
      }
    }

    return recentChats.sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime(),
    );
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
      { _id: messageId, sender: userId }, // seul l'expéditeur peut modifier
      { $set: { payload, updatedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  // ----- NOUVELLE MÉTHODE : soft delete -----
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
}
