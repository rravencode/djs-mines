// @ts-check
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionCollector } from "discord.js";
import db from "../db.js";

export class Mine {
  /**
   *
   * @param {{ client: import("discord.js").Client<true>, interaction: import("discord.js").ChatInputCommandInteraction }} param0
   */
  constructor({ client, interaction }) {
    this.interaction = interaction;
    this.client = client;

    this.booms = 3;
    this.bet = null;

    /** @type {ActionRowBuilder<ButtonBuilder>[]} */
    this.map = [];

    this.played = false;
    this.end = false;
    this.win = false;

    /** @type {Map<"cashier" | "player", import("discord.js").Message>} */
    this.messages = new Map();
  }

  get key() {
    const { interaction } = this;
    return `users.${interaction.user.id}.money`;
  }

  /** @returns {import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder>} */
  get components() {
    // @ts-ignore
    return new ActionRowBuilder().setComponents(
      new ButtonBuilder()
        .setCustomId("cashOut")
        .setLabel("Parayı talep et")
        .setDisabled(!this.played)
        .setStyle(ButtonStyle[!this.win ? "Secondary" : "Success"]),
      new ButtonBuilder()
        .setCustomId("stopGame")
        .setDisabled(this.played || this.end)
        .setLabel("Vazgeç")
        .setStyle(ButtonStyle.Danger)
    );
  }

  /** @param {number} booms  */
  setBooms(booms) {
    this.booms = booms;
    return this;
  }

  /**
   * 
   * @param {string} btnID 
   */
  getID(btnID) {
    return btnID.split("[")[1].slice(0, -1);
  }

  /**
   * 
   * @returns
   */
  setEnd() {
    this.end = true;
    this.played = false;
    return this;
  }

  /**
   * 
   * @returns
   */
  setPlayed() {
    this.played = true;
    return this;
  }

  /**
   * 
   * @returns 
   */
  setWin() {
    this.win = true;
    return true;
  }

  /**
   * 
   * @param {number} bet 
   */
  checkBet(bet) {
    const { key } = this;

    const userMoney = db.get(key);
    this.bet = bet;

    if (userMoney >= bet) {
      db.subtract(key, bet);
      return true;
    }

    return false;
  }

  /** @returns {ActionRowBuilder<ButtonBuilder>[]} */
  generateMap() {
    const map = Array.from({ length: 25 }).map((_, index) => {
      return new ButtonBuilder()
        .setCustomId(`blockID[${index}]`)
        .setEmoji("⬜")        
        .setStyle(ButtonStyle.Secondary);
    });

    const booms = this.chooseBombs(map);
    booms.forEach((button) => button.setCustomId(`boomID[${this.getID(button.data["custom_id"])}]`));

    /** @type {ActionRowBuilder<ButtonBuilder>[]} */
    const rows = map.reduce((result, current, index) => {
      const chunkIndex = Math.floor(index / 5);

      if (!result[chunkIndex]) {
        // @ts-ignore
        result[chunkIndex] = new ActionRowBuilder();
      }

      // @ts-ignore
      result[chunkIndex].addComponents(current);
      return result;
    }, []);

    this.map = rows;
    return rows;
  }

  /**
   * 
   * @param {ButtonBuilder[]} map 
   * @returns 
   */
  chooseBombs(map) {
    const { booms } = this;
    const elements = [];

    while (elements.length < booms) {
      const randomIndex = Math.floor(Math.random() * map.length);
      
      const element = map[randomIndex];
      if (!elements.includes(element)) elements.push(element);
    }

    return elements;
  }

  calculateMultiplier() {
    const { map } = this;
    const stars = map.map((row) => row.components).flat().filter((button) => button.data.style === ButtonStyle.Success).length;

    return stars;
  }

  async initalize() {
    const { client, interaction } = this;

    const cashier = await interaction.editReply({
      content: `**🪙 İlk mayınınızı açın ve kazanmaya başlayın!**`,
      embeds: [
        new EmbedBuilder()
          .setColor("#8d0b0e")
          .setAuthor({
            iconURL: interaction.user.displayAvatarURL(),
            name: `Mines — ${interaction.user.globalName ?? interaction.user.displayName}`
          })
          .setDescription("Mines, oyuncuların bahis yaparak kazanç elde etmeye çalıştıkları heyecan verici bir kumar oyunudur. Oyun, bir ızgara üzerinde yerleştirilmiş gizli mayınlar ve kazanç sembolleri içerir. Amacınız, mayınlara basmadan mümkün olduğunca çok kazanç sembolü açarak ödüller kazanmaktır.")
          .setFields({
            name: "ℹ️ Tüyo:",
            value: "Yüksek ödüller kazanmak için daha fazla kare açabilirsiniz, ancak mayınlara basma riskini de göze almalısınız."
          })
          .setTimestamp()
          .setFooter({
            text: `${client.user.username} ©️ 2024`,
            iconURL: client.user.displayAvatarURL()
          }),
      ],
      components: [this.components]
    });
    
    const message = await cashier.reply({ components: this.generateMap() });
    this.message = message;

    const collector = new InteractionCollector(client, {
      filter: (i) => i.user.id === interaction.user.id && (i.message?.id === message.id || i.message?.id === cashier.id),
    });
    
    collector.on("collect", async (i) => {
      const { customId } = i;

      /** @param {string} id */
      const checkId = (id) => i.customId === id;

      if (i.isButton()) {
        if (customId.startsWith("blockID")) {
          if (!this.played) this.setPlayed();

          const componentData = this.map.find(
            (componentD) => componentD.components.find(
              (buttonData) => buttonData.data["custom_id"] === i.customId)
          );
          const buttonData = componentData && componentData.components.find((buttonD) => buttonD.data["custom_id"] === i.customId);

          if (buttonData) {
            buttonData.setDisabled(true);
            buttonData.setEmoji("⭐");
            buttonData.setStyle(ButtonStyle.Success);
          }

          await i.update({ components: this.map });
          await cashier.edit({ content: `**🌟 Bahisiniz \`${this.calculateMultiplier()}x\` ile çarpılacaktır.**`, components: [this.components] });
          await this.checkWin();

        } else if (customId.startsWith("boomID")) {
          this.setEnd();

          this.map.forEach((componentData) => {
            componentData.components.forEach((buttonData) => {
              buttonData
                .setDisabled(true)
                .setEmoji(buttonData.data["custom_id"].startsWith("boomID") ? "💣" : "⭐")
            });
          });
          
          const componentData = this.map.find(
            (componentD) => componentD.components.find(
              (buttonData) => buttonData.data["custom_id"] === i.customId)
          );

          if (componentData) {
            const buttonData = componentData.components.find((buttonD) => buttonD.data["custom_id"] === i.customId);
            buttonData && buttonData.setStyle(ButtonStyle.Danger)
          }

          await i.update({ components: this.map });
          await cashier.edit({
            content: `**:x: Kaybettiniz, bir daha ki sefere iyi şanslar. (\`${this.calculateMultiplier()}x\`)**`,
            components: [this.components]
          });
        }

        if (checkId("stopGame")) {
          this.setEnd();

          this.map.forEach((componentData) => {
            componentData.components.forEach((buttonData) => {
              buttonData
                .setDisabled(true)
                .setEmoji(buttonData.data["custom_id"].startsWith("boomID") ? "💣" : "⭐")
            })
          });

          this.bet && db.add(this.key, this.bet);

          await message.edit({ components: this.map });
          await i.update({
            content: `**:x: Oyun iptal edildi, paranız geri iade edilecektir.**`,
            components: [this.components]
          });
        } else if(checkId("cashOut")) {
          this.setEnd();
          this.setWin();

          const credit = this.calculateMultiplier() * (this.bet ?? 0);
          db.add(this.key, credit);

          this.map.forEach((componentData) => {
            componentData.components.forEach((buttonData) => {
              buttonData
                .setDisabled(true)
                .setEmoji(buttonData.data["custom_id"].startsWith("boomID") ? "💣" : "⭐")
            })
          });

          await message.edit({ components: this.map });
          await i.update({
            content: `**✅ Oyundan çekildiniz, kazancınız olan \`💵 ${credit}\` krediniz hesabınıza gönderilmiştir.**`,
            components: [this.components]
          });
        }
      }
    });
  }

  /** @private */
  async checkWin() {
    const { interaction, message } = this;

    const stars = this.map.map((rows) => rows.components).flat().filter((button) => button.data.style === ButtonStyle.Success).length;
    const mines = this.map.map((rows) => rows.components).flat().length;

    if (stars === (mines - this.booms)) {
      this.setEnd();
      this.setWin();

      const credit = this.calculateMultiplier() * (this.bet ?? 0);
      db.add(this.key, credit);

      this.map.forEach((componentData) => {
        componentData.components.forEach((buttonData) => {
          buttonData
            .setDisabled(true)
            .setEmoji(buttonData.data["custom_id"].startsWith("boomID") ? "💣" : "⭐")
        });
      });

      
      await message?.edit({ components: this.map });
      await interaction.editReply({ 
        content: `**✅ Hepsini doğru bildiniz, kazancınız olan \`💵 ${credit}\` krediniz hesabınıza gönderilmiştir.**`,
        components: [this.components]
      });
    }
  }
}