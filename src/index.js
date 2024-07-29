// @ts-check
import { Client, Partials } from "discord.js";
import { CommandHandler, EventHandler } from "djs-bot-base";
import settings from "./settings.js";

const client = new Client({
  intents: ["Guilds"],
  partials: [Partials.Channel, Partials.Message, Partials.User],
  failIfNotExists: true,
});

const commandManager = new CommandHandler({ slashCommandsDir: "./src/commands" });
const eventManager = new EventHandler({ eventsDir: "./src/events" });

// @ts-ignore
client.commandManager = commandManager;
// @ts-ignore
client.eventManager = eventManager;

(async () => {
  await commandManager.setSlashCommands();
  await eventManager.setEvents(client);
  
  commandManager.setDefaultSlashHandler(client);
  await client.login(settings.token);
})();