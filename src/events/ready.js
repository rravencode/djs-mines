// @ts-check
import { Event } from "djs-bot-base";

export default new Event({
  categoryName: "ready",
  async run(client) {
    console.log(`Discord'a başarıyla ${client.user.username} olarak giriş yapıldı.`);
    // @ts-ignore
    await client.commandManager.registerSlashCommands(client);
  }
});