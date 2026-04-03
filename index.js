import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } from 'discord.js';
import OpenAI from 'openai';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const AI_CHANNEL_ID = '1487006871272554557';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

function parseDuration(str) {
  if (str.endsWith('m')) return parseInt(str) * 60000;
  if (str.endsWith('h')) return parseInt(str) * 3600000;
  if (str.endsWith('d')) return parseInt(str) * 86400000;
  return 0;
}

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Gecikme süresi'),
  new SlashCommandBuilder().setName('sunucu').setDescription('Sunucu bilgisi'),
  new SlashCommandBuilder().setName('sustur').setDescription('Timeout atar')
    .addUserOption(o => o.setName('kullanıcı').setDescription('Kişi').setRequired(true))
    .addStringOption(o => o.setName('süre').setDescription('10m, 1h, 1d').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep')),
  new SlashCommandBuilder().setName('susturma-kaldir').setDescription('Timeout kaldırır')
    .addUserOption(o => o.setName('kullanıcı').setDescription('Kişi').setRequired(true)),
  new SlashCommandBuilder().setName('yasakla').setDescription('Banlar')
    .addUserOption(o => o.setName('kullanıcı').setDescription('Kişi').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('yasaklama-kaldir').setDescription('Ban kaldırır')
    .addStringOption(o => o.setName('kullanici-id').setDescription('ID').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('duyuru').setDescription('Duyuru gönderir')
    .addStringOption(o => o.setName('metin').setDescription('Metin').setRequired(true))
    .addChannelOption(o => o.setName('kanal').setDescription('Kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder().setName('rol-ver').setDescription('Rol verir')
    .addUserOption(o => o.setName('kullanıcı').setDescription('Kişi').setRequired(true))
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
  new SlashCommandBuilder().setName('rol-al').setDescription('Rol alır')
    .addUserOption(o => o.setName('kullanıcı').setDescription('Kişi').setRequired(true))
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
];

client.once(Events.ClientReady, async (rc) => {
  console.log(rc.user.tag + ' aktif!');
  await new REST().setToken(TOKEN).put(Routes.applicationCommands(rc.user.id), { body: commands.map(c => c.toJSON()) });
  try { await rc.application.edit({ description: 'Rety Sunucusunun özel botudur.\n\nKurucu: Necth' }); } catch {}
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild, member } = interaction;
  const hasPerm = (flag) => member.permissions.has(flag);

  try {
    if (commandName === 'ping') {
      const sent = await interaction.reply({ content: 'Hesaplanıyor...', fetchReply: true });
      await interaction.editReply('🏓 Pong! Bot: ' + (sent.createdTimestamp - interaction.createdTimestamp) + 'ms | API: ' + Math.round(interaction.client.ws.ping) + 'ms');

    } else if (commandName === 'sunucu') {
      const owner = await guild.fetchOwner();
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📊 ' + guild.name)
        .addFields({ name: '👑 Sahip', value: owner.user.tag, inline: true }, { name: '👥 Üye', value: String(guild.memberCount), inline: true }).setTimestamp()] });

    } else if (commandName === 'sustur') {
      if (!hasPerm(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const user = interaction.options.getUser('kullanıcı', true);
      const süre = interaction.options.getString('süre', true);
      const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
      const ms = parseDuration(süre);
      if (!ms) return interaction.reply({ content: '❌ Geçersiz süre!', ephemeral: true });
      const target = await guild.members.fetch(user.id);
      await target.timeout(ms, sebep);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('🔇 Susturuldu')
        .setDescription('**' + user.username + '** ' + süre + ' susturuldu!').addFields({ name: '📌 Sebep', value: sebep })
        .setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });

    } else if (commandName === 'susturma-kaldir') {
      if (!hasPerm(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const user = interaction.options.getUser('kullanıcı', true);
      const target = await guild.members.fetch(user.id);
      await target.timeout(null);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🔊 Susturma Kaldırıldı')
        .setDescription('**' + user.username + '** artık susturulmuş değil!').setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });

    } else if (commandName === 'yasakla') {
      if (!hasPerm(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const user = interaction.options.getUser('kullanıcı', true);
      const sebep = interaction.options.getString('sebep', true);
      await guild.members.ban(user.id, { reason: sebep });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔨 Yasaklandı')
        .setDescription('**' + user.username + '** yasaklandı!').addFields({ name: '📌 Sebep', value: sebep })
        .setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });

    } else if (commandName === 'yasaklama-kaldir') {
      if (!hasPerm(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const userId = interaction.options.getString('kullanici-id', true);
      const sebep = interaction.options.getString('sebep', true);
      const banInfo = await guild.bans.fetch(userId);
      await guild.members.unban(userId, sebep);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🔓 Yasak Kaldırıldı')
        .setDescription('**' + banInfo.user.username + '** kullanıcısının yasağı **' + sebep + '** sebebiyle kaldırıldı!')
        .setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });

    } else if (commandName === 'duyuru') {
      if (!hasPerm(PermissionsBitField.Flags.ManageMessages)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const metin = interaction.options.getString('metin', true);
      const kanal = interaction.options.getChannel('kanal', true);
      await kanal.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📢 Duyuru').setDescription(metin)
        .setFooter({ text: 'Duyuruyu yapan: ' + interaction.user.tag }).setTimestamp()] });
      await interaction.reply({ content: '✅ Duyuru gönderildi!', ephemeral: true });

    } else if (commandName === 'rol-ver') {
      if (!hasPerm(PermissionsBitField.Flags.ManageRoles)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const user = interaction.options.getUser('kullanıcı', true);
      const role = interaction.options.getRole('rol', true);
      const target = await guild.members.fetch(user.id);
      await target.roles.add(role.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ Rol Verildi')
        .setDescription('**' + user.username + '** kullanıcısına **' + role.name + '** rolü verildi!')
        .setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });

    } else if (commandName === 'rol-al') {
      if (!hasPerm(PermissionsBitField.Flags.ManageRoles)) return interaction.reply({ content: '❌ Yetkisiz!', ephemeral: true });
      const user = interaction.options.getUser('kullanıcı', true);
      const role = interaction.options.getRole('rol', true);
      const target = await guild.members.fetch(user.id);
      await target.roles.remove(role.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🎭 Rol Alındı')
        .setDescription('**' + user.username + '** kullanıcısından **' + role.name + '** rolü alındı!')
        .setFooter({ text: 'İşlemi yapan: ' + interaction.user.tag }).setTimestamp()] });
    }
  } catch (e) {
    const msg = '❌ Hata: ' + e.message;
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true });
    else await interaction.reply({ content: msg, ephemeral: true });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.channelId !== AI_CHANNEL_ID || !message.content.trim() || !openai) return;
  try {
    await message.channel.sendTyping();
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Sen Rety sunucusunun yardımcı botusun. Türkçe kısa ve net cevapla.' }, { role: 'user', content: message.content }]
    });
    await message.reply(res.choices[0]?.message?.content || '❌ Cevap üretilemedi.');
  } catch { await message.reply('❌ Şu an cevap veremiyorum.'); }
});

client.login(TOKEN);
