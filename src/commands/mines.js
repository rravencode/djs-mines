// @ts-check
import { SlashCommand } from "djs-bot-base";
import { Mine } from "../classes/mine.js";

export default new SlashCommand({
  slashCommandData: (builder) => builder
    .setName("mines")
    .setDescription("Belirli bir bahis oynayarak yüklü miktarlar kazanabilirsiniz.")
    .addNumberOption((input) => input
      .setName("bet")
      .setDescription("Oynamak istediğiniz miktarı girmelisiniz.")
      .setRequired(true)
    )
    .addIntegerOption((input) => input
      .setName("booms")
      .setDescription("Bomba miktarını arttırarak aynı zamanda kazancınızı da arttırabilirsiniz.")
      .setMaxValue(24)
      .setMinValue(1)
    ),
  
  async run(interaction) {
    await interaction.deferReply();
    const client = interaction.client;

    const bet = interaction.options.getNumber("bet", true);
    const booms = interaction.options.getInteger("booms", false) ?? 3;

    const mine = new Mine({ client, interaction }).setBooms(booms);
    if (!mine.checkBet(bet)) {
      await interaction.editReply("**:x: Bu işlem için yeterli paranız bulunmuyor. :x:**");
      return;
    }

    await mine.initalize();
  }
});